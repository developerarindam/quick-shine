"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileSpreadsheet, Plus, Undo2, Upload, XCircle } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { useConfirm, useToast } from "@/app/components/overlays";
import { Badge, Button, Card, Field, Input, Page, SectionTitle, Select, Switch, Textarea, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { fmtDate, fmtWhen, inr } from "@/app/lib/format";
import {
  FIELDS,
  distance,
  findHeaderRow,
  guessColumns,
  initials,
  parseAmount,
  parseDate,
  parseDelimited,
  readFile,
  splitCodes,
  text,
  type FieldKey,
  type Grid,
} from "@/app/lib/sheet";
import type { Service, TeamMember } from "@/app/lib/types";

// what a "Collected by" / "Done by" value means
type PersonChoice = { kind: "user"; id: string } | { kind: "online" } | { kind: "pending" } | { kind: "free" } | { kind: "none" };
type DryRun = {
  summary: { rows: number; ready: number; errors: number; duplicatesSkipped: number; cash: number; online: number; newBikes: number; imported?: number };
  issues: { line: number; level: "error" | "warning"; message: string }[];
};
type Batch = { _id: string; fileName?: string; jobs: number; bikesCreated: number; cash: number; online: number; from?: string; to?: string; createdAt: string; undoneAt?: string; by?: { name: string } };

const decode = (v: string): PersonChoice => (v.startsWith("user:") ? { kind: "user", id: v.slice(5) } : ({ kind: v } as PersonChoice));

export default function ImportClient() {
  const me = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const services = useApi<Service[]>("/api/services?all=1");
  const team = useApi<TeamMember[]>("/api/users?lite=1");
  const batches = useApi<Batch[]>("/api/import/jobs");

  // ── 1. source ──
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<{ name: string; rows: Grid }[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);

  const grid = useMemo(() => sheets[sheetIdx]?.rows || [], [sheets, sheetIdx]);
  const headerRow = useMemo(() => findHeaderRow(grid), [grid]);
  const headers = useMemo(() => (grid[headerRow] || []).map((c) => text(c)), [grid, headerRow]);
  const body = useMemo(
    () =>
      grid
        .slice(headerRow + 1)
        .map((cells, i) => ({ cells, line: headerRow + i + 2 }))
        .filter(({ cells }) => cells.some((c) => text(c))),
    [grid, headerRow]
  );

  // ── 2. columns ──
  const [columns, setColumns] = useState<Partial<Record<FieldKey, number>>>({});
  const col = (key: FieldKey, cells: Grid[number]) => (columns[key] === undefined ? null : cells[columns[key]!] ?? null);

  // ── 3. codes / 4. people ──
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  // codes matched by guessing (initials / name) — shown as "check" until confirmed
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [peopleMap, setPeopleMap] = useState<Record<string, string>>({});
  const [doneMap, setDoneMap] = useState<Record<string, string>>({});
  const [newService, setNewService] = useState<{ code: string; name: string; price: string; hidden: boolean } | null>(null);

  // ── 5. preview ──
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "import">("");

  const load = (list: { name: string; rows: Grid }[], name: string) => {
    if (!list.length || !list.some((s) => s.rows.length > 1)) {
      toast("No rows found in that file", "error");
      return;
    }
    // pick the first sheet that has a date + vehicle header
    const best = Math.max(
      0,
      list.findIndex((s) => {
        const h = findHeaderRow(s.rows);
        return (s.rows[h] || []).some((c) => /date/i.test(text(c)));
      })
    );
    setSheets(list);
    setSheetIdx(best);
    setFileName(name);
    setPreview(null);
    autoMap(list[best].rows);
  };

  const autoMap = (rows: Grid) => {
    const h = findHeaderRow(rows);
    const cols = guessColumns((rows[h] || []).map((c) => text(c)));
    setColumns(cols);
    const data = rows.slice(h + 1);

    // service codes → services (saved code, then initials, then name)
    const codes = new Set<string>();
    for (const r of data) if (cols.services !== undefined) splitCodes(r[cols.services] ?? null).forEach((c) => codes.add(c));
    const all = services.data || [];
    const cm: Record<string, string> = {};
    const g = new Set<string>();
    for (const code of codes) {
      const saved = all.find((s) => s.code?.toUpperCase() === code);
      const guess =
        all.find((s) => s.name.toUpperCase().replace(/[^A-Z0-9]/g, "") === code) || all.find((s) => initials(s.name) === code);
      if (saved) cm[code] = saved._id;
      else if (guess) {
        cm[code] = guess._id;
        g.add(code);
      }
    }
    setCodeMap(cm);
    setGuessed(g);

    // people values → team members / meanings
    const guess = (raw: string, forDone: boolean): string => {
      const v = raw.trim().toLowerCase();
      if (!v) return "none";
      if (!forDone) {
        if (/^online|upi|gpay|phonepe/.test(v)) return "online";
        if (/^cash$/.test(v)) return `user:${me.id}`;
        if (/^pending|due|unpaid|^n$|^no$/.test(v)) return "pending";
        if (/free|foc/.test(v)) return "free";
      }
      const first = (n: string) => n.toLowerCase().split(/\s+/)[0];
      const match =
        (team.data || []).find((m) => first(m.name) === v || m.name.toLowerCase() === v) ||
        (team.data || []).find((m) => distance(first(m.name), v) <= 2);
      return match ? `user:${match._id}` : "none";
    };
    const pm: Record<string, string> = {};
    const dm: Record<string, string> = {};
    for (const r of data) {
      if (cols.collectedBy !== undefined) {
        const v = text(r[cols.collectedBy] ?? null);
        if (!(v in pm)) pm[v] = guess(v, false);
      }
      if (cols.doneBy !== undefined) {
        const v = text(r[cols.doneBy] ?? null);
        if (!(v in dm)) dm[v] = guess(v, true);
      }
    }
    setPeopleMap(pm);
    setDoneMap(dm);
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setLoadingFile(true);
    try {
      load(await readFile(file), file.name);
    } catch (e) {
      toast((e as Error).message || "Couldn't read that file", "error");
    } finally {
      setLoadingFile(false);
    }
  };

  // unique codes and people values in the sheet
  const codeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { cells } of body) splitCodes(col("services", cells)).forEach((c) => m.set(c, (m.get(c) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [body, columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const valuesOf = (key: FieldKey) => {
    const m = new Map<string, number>();
    for (const { cells } of body) {
      const v = text(col(key, cells));
      m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const sheetTotals = useMemo(
    () => ({
      cash: body.reduce((s, { cells }) => s + parseAmount(col("cash", cells)), 0),
      online: body.reduce((s, { cells }) => s + parseAmount(col("online", cells)), 0),
    }),
    [body, columns] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // rows in the shape the server expects
  const buildRows = () =>
    body.map(({ cells, line }) => {
      const who = decode(peopleMap[text(col("collectedBy", cells))] || "none");
      const done = decode(doneMap[text(col("doneBy", cells))] || "none");
      const unpaid = who.kind === "pending";
      const remarks = text(col("remarks", cells));
      return {
        line,
        date: parseDate(col("date", cells)) || "",
        bikeNumber: text(col("bikeNumber", cells)),
        serviceIds: splitCodes(col("services", cells)).map((c) => codeMap[c]).filter(Boolean) as string[],
        missingCodes: splitCodes(col("services", cells)).filter((c) => !codeMap[c]),
        cash: unpaid ? 0 : parseAmount(col("cash", cells)),
        online: unpaid ? 0 : parseAmount(col("online", cells)),
        collectorId: who.kind === "user" ? who.id : null,
        assignedTo: done.kind === "user" ? done.id : null,
        free: who.kind === "free",
        notes: remarks || undefined,
      };
    });

  const unmappedCodes = codeCounts.filter(([c]) => !codeMap[c]);
  const missingRequired = FIELDS.filter((f) => f.required && columns[f.key] === undefined);

  const run = async (dryRun: boolean) => {
    if (missingRequired.length) return toast(`Choose the column for: ${missingRequired.map((f) => f.label).join(", ")}`, "error");
    if (unmappedCodes.length) return toast(`Match these service codes first: ${unmappedCodes.map(([c]) => c).join(", ")}`, "error");
    if (guessed.size) return toast(`Confirm the guessed matches (tap "check ✓"): ${[...guessed].join(", ")}`, "error");
    if (!dryRun) {
      const ok = await confirm({
        title: `Import ${preview?.summary.ready ?? ""} jobs?`,
        message: "They'll appear on their real dates in jobs, bikes and reports. You can undo the whole import afterwards.",
        confirmText: "Import",
      });
      if (!ok) return;
    }
    setBusy(dryRun ? "check" : "import");
    try {
      // remember codes on services that don't have one yet, so next month matches automatically
      if (!dryRun) {
        for (const [code, id] of Object.entries(codeMap)) {
          const s = services.data?.find((x) => x._id === id);
          if (s && !s.code) await api(`/api/services/${id}`, { method: "PUT", body: { code } });
        }
      }
      const rows = buildRows().map(({ missingCodes: _m, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
      const res = await api<DryRun>("/api/import/jobs", { method: "POST", body: { rows, dryRun, fileName, skipDuplicates } });
      setPreview(res);
      if (!dryRun) {
        toast(`Imported ${res.summary.imported} jobs`);
        batches.reload();
        services.reload();
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };

  const createService = async () => {
    if (!newService?.name.trim()) return toast("Give the service a name", "error");
    try {
      const s = await api<Service>("/api/services", {
        method: "POST",
        body: { name: newService.name, price: Number(newService.price) || 0, code: newService.code, isActive: !newService.hidden, category: "basic" },
      });
      toast(`${s.name} added${newService.hidden ? " (hidden from new jobs)" : ""}`);
      setCodeMap((m) => ({ ...m, [newService.code]: s._id }));
      setNewService(null);
      services.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const undo = async (b: Batch) => {
    const ok = await confirm({ title: `Undo this import?`, message: `Removes its ${b.jobs} jobs (and bikes it created that have no other jobs).`, confirmText: "Undo import", danger: true });
    if (!ok) return;
    try {
      const r = await api<{ jobsRemoved: number; bikesRemoved: number }>(`/api/import/${b._id}`, { method: "DELETE" });
      toast(`Removed ${r.jobsRemoved} jobs and ${r.bikesRemoved} bikes`);
      batches.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const personOptions = (forDone: boolean) => (
    <>
      <option value="none">{forDone ? "Nobody" : "Nobody / ignore"}</option>
      {!forDone && (
        <>
          <option value="online">Online → Chandan Manna&apos;s account</option>
          <option value="pending">Pending — not paid yet (due)</option>
          <option value="free">Free — no charge</option>
        </>
      )}
      {(team.data || []).map((m) => (
        <option key={m._id} value={`user:${m._id}`}>
          {m.name}
          {m._id === me.id ? " (me)" : ""}
        </option>
      ))}
    </>
  );

  const errorLines = new Set((preview?.issues || []).filter((i) => i.level === "error").map((i) => i.line));

  return (
    <Page title="Import old data" subtitle="Bring previous months' jobs in from Excel" back="/dashboard/more">
      {/* 1. Source */}
      <SectionTitle>1 · Your sheet</SectionTitle>
      <Card className="space-y-3 p-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center">
          <FileSpreadsheet className="size-8 text-brand-600" />
          <span className="font-semibold text-slate-800">{fileName || "Choose Excel (.xlsx) or CSV file"}</span>
          <span className="text-xs text-slate-500">Google Sheets: File → Download → Microsoft Excel (.xlsx)</span>
          <input type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {loadingFile && <span className="text-xs text-brand-600">Reading…</span>}
        </label>
        {!pasteOpen ? (
          <button type="button" onClick={() => setPasteOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600">
            <ClipboardPaste className="size-4" /> Or paste rows copied from the sheet
          </button>
        ) : (
          <div className="space-y-2">
            <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Select the rows in Excel / Google Sheets (with the header row), copy and paste here" className="min-h-32 font-mono text-xs" />
            <Button variant="secondary" size="sm" disabled={!pasted.trim()} onClick={() => load([{ name: "Pasted rows", rows: parseDelimited(pasted) }], "Pasted rows")}>
              Use pasted rows
            </Button>
          </div>
        )}
        {sheets.length > 1 && (
          <Field label="Sheet">
            <Select value={sheetIdx} onChange={(e) => { setSheetIdx(Number(e.target.value)); autoMap(sheets[Number(e.target.value)].rows); setPreview(null); }}>
              {sheets.map((s, i) => (
                <option key={s.name + i} value={i}>
                  {s.name} ({s.rows.length} rows)
                </option>
              ))}
            </Select>
          </Field>
        )}
        {body.length > 0 && (
          <p className="text-sm text-slate-600">
            Found <b>{body.length}</b> rows · sheet totals: cash <b>{inr(sheetTotals.cash)}</b>, online <b>{inr(sheetTotals.online)}</b>
          </p>
        )}
      </Card>

      {body.length > 0 && (
        <>
          {/* 2. Columns */}
          <SectionTitle>2 · Columns</SectionTitle>
          <Card className="grid gap-3 p-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                <Select
                  value={columns[f.key] ?? ""}
                  onChange={(e) => {
                    setColumns((c) => ({ ...c, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }));
                    setPreview(null);
                  }}
                >
                  <option value="">— not in my sheet —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </Card>

          {/* 3. Service codes */}
          <SectionTitle>3 · Service codes</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {codeCounts.map(([code, count]) => (
              <div key={code} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge tone={codeMap[code] ? "brand" : "red"} className="w-16 justify-center">
                    {code}
                  </Badge>
                  <span className="w-10 shrink-0 text-xs text-slate-500">×{count}</span>
                  {guessed.has(code) && (
                    <button
                      type="button"
                      title="Guessed from the name — tap to confirm"
                      onClick={() =>
                        setGuessed((g) => {
                          const next = new Set(g);
                          next.delete(code);
                          return next;
                        })
                      }
                      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"
                    >
                      check ✓
                    </button>
                  )}
                  <Select
                    value={codeMap[code] || ""}
                    onChange={(e) => {
                      if (e.target.value === "__new") {
                        setNewService({ code, name: "", price: "", hidden: false });
                        return;
                      }
                      setCodeMap((m) => ({ ...m, [code]: e.target.value }));
                      setGuessed((g) => {
                        const next = new Set(g);
                        next.delete(code);
                        return next;
                      });
                      setPreview(null);
                    }}
                    className="min-w-0 flex-1"
                  >
                    <option value="">Choose service…</option>
                    {(services.data || []).map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} — {inr(s.price)}
                        {s.isActive ? "" : " (hidden)"}
                      </option>
                    ))}
                    <option value="__new">+ Create a new service…</option>
                  </Select>
                </div>
                {newService?.code === code && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Input className="col-span-2" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} placeholder="Service name" autoFocus />
                      <Input type="number" inputMode="decimal" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} placeholder="Price ₹" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Discontinued (hide from new jobs)</span>
                      <Switch checked={newService.hidden} onChange={(v) => setNewService({ ...newService, hidden: v })} label="Discontinued" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" icon={<Plus className="size-4" />} onClick={createService}>
                        Add service
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNewService(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-xs text-slate-500">
            When a row has several services (e.g. FW+CCL), its total is split between them by their list prices. Matches are remembered for next time.
          </p>

          {/* 4. People */}
          {columns.collectedBy !== undefined && (
            <>
              <SectionTitle>4 · Collected by</SectionTitle>
              <Card className="divide-y divide-slate-100">
                {valuesOf("collectedBy").map(([v, count]) => (
                  <div key={v} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-24 shrink-0 truncate text-sm font-semibold text-slate-800">{v || "(blank)"}</span>
                    <span className="w-10 shrink-0 text-xs text-slate-500">×{count}</span>
                    <Select value={peopleMap[v] || "none"} onChange={(e) => { setPeopleMap((m) => ({ ...m, [v]: e.target.value })); setPreview(null); }} className="min-w-0 flex-1">
                      {personOptions(false)}
                    </Select>
                  </div>
                ))}
              </Card>
              <p className="mt-2 px-1 text-xs text-slate-500">
                Cash goes to the chosen person&apos;s cash in hand (&quot;Nobody&quot; = you). Online always goes to Chandan Manna&apos;s account. Rows with no amount become dues.
              </p>
            </>
          )}
          {columns.doneBy !== undefined && (
            <>
              <SectionTitle>Done by</SectionTitle>
              <Card className="divide-y divide-slate-100">
                {valuesOf("doneBy").map(([v, count]) => (
                  <div key={v} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-24 shrink-0 truncate text-sm font-semibold text-slate-800">{v || "(blank)"}</span>
                    <span className="w-10 shrink-0 text-xs text-slate-500">×{count}</span>
                    <Select value={doneMap[v] || "none"} onChange={(e) => { setDoneMap((m) => ({ ...m, [v]: e.target.value })); setPreview(null); }} className="min-w-0 flex-1">
                      {personOptions(true)}
                    </Select>
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* 5. Preview & import */}
          <SectionTitle>5 · Check & import</SectionTitle>
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Skip rows already in the app</p>
                <p className="text-xs text-slate-500">Same bike on the same day</p>
              </div>
              <Switch checked={skipDuplicates} onChange={(v) => { setSkipDuplicates(v); setPreview(null); }} label="Skip duplicates" />
            </div>
            <Button variant="secondary" size="lg" className="w-full" loading={busy === "check"} onClick={() => run(true)}>
              Check {body.length} rows
            </Button>

            {preview && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-emerald-50 py-2">
                    <p className="text-lg font-bold text-emerald-700">{preview.summary.imported ?? preview.summary.ready}</p>
                    <p className="text-xs text-emerald-800">{preview.summary.imported !== undefined ? "imported" : "ready"}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 py-2">
                    <p className="text-lg font-bold text-red-600">{preview.summary.errors}</p>
                    <p className="text-xs text-red-700">with errors</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 py-2">
                    <p className="text-lg font-bold text-amber-700">{preview.summary.duplicatesSkipped}</p>
                    <p className="text-xs text-amber-800">already in app</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Will add cash <b>{inr(preview.summary.cash)}</b> + online <b>{inr(preview.summary.online)}</b> · {preview.summary.newBikes} new bike(s)
                </p>
                {preview.issues.length > 0 && (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                    {preview.issues.map((i, k) => {
                      const row = body.find((b) => b.line === i.line);
                      return (
                        <p key={k} className={cn("flex gap-2 text-xs", i.level === "error" ? "text-red-700" : "text-amber-700")}>
                          {i.level === "error" ? <XCircle className="mt-px size-3.5 shrink-0" /> : <AlertTriangle className="mt-px size-3.5 shrink-0" />}
                          <span>
                            Row {i.line}
                            {row ? ` (${text(col("bikeNumber", row.cells))})` : ""}: {i.message}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                )}
                {preview.summary.imported === undefined ? (
                  <Button size="lg" className="w-full" loading={busy === "import"} disabled={!preview.summary.ready} icon={<Upload className="size-5" />} onClick={() => run(false)}>
                    Import {preview.summary.ready} jobs{errorLines.size ? ` (skip ${errorLines.size} with errors)` : ""}
                  </Button>
                ) : (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="size-4" /> Done — open Jobs → History or Reports to see them on their dates.
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {/* Past imports */}
      {!!batches.data?.length && (
        <>
          <SectionTitle>Past imports</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {batches.data.map((b) => (
              <div key={b._id} className="flex items-center gap-3 px-4 py-3">
                <FileSpreadsheet className="size-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {b.fileName || "Sheet"} · {b.jobs} jobs
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {b.from && b.to ? `${fmtDate(`${b.from}T00:00:00`)} – ${fmtDate(`${b.to}T00:00:00`)} · ` : ""}
                    cash {inr(b.cash)} · online {inr(b.online)} · {fmtWhen(b.createdAt)}
                  </p>
                </div>
                {b.undoneAt ? (
                  <Badge>Undone</Badge>
                ) : (
                  <Button variant="outline" size="sm" icon={<Undo2 className="size-4" />} onClick={() => undo(b)}>
                    Undo
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </Page>
  );
}
