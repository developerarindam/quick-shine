"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ClipboardList, Download, LayoutGrid, List, Plus, SlidersHorizontal, X } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { JobGridCard, JobListRow, JobTable, exportJobsToExcel } from "@/app/components/jobList";
import { Sheet, useToast } from "@/app/components/overlays";
import { Button, Card, Chips, EmptyState, ErrorState, Field, Input, ListSkeleton, Page, SearchInput, Segmented, Select, buttonClass, cn } from "@/app/components/ui";
import { useApi, useDayKey } from "@/app/lib/api";
import { LIST_KEYS, rememberListUrl } from "@/app/lib/listState";
import { can } from "@/app/lib/roles";
import { ACTIVE_STATUSES, JOB_STATUSES, STATUS_META, type JobStatus } from "@/app/lib/jobs";
import {
  EMPTY_FILTERS,
  SORT_LABEL,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  sortRows,
  toRow,
  totalsOf,
  type JobFilters,
  type PayKind,
  type PayState,
  type SortKey,
} from "@/app/lib/jobRows";
import {
  RANGE_LABEL,
  endOfDay,
  fromDateInput,
  inr,
  rangeFor,
  rangeQuery,
  toDateInput,
  type RangePreset,
} from "@/app/lib/format";
import type { Job, Service, TeamMember } from "@/app/lib/types";

type Tab = "active" | "history" | "due";

const TABS: Tab[] = ["active", "history", "due"];
const PRESETS: RangePreset[] = ["today", "yesterday", "week", "month", "custom"];
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const SORTS = Object.keys(SORT_LABEL) as SortKey[];

// List on desktop, grid on phones — unless the person picked one before on this device
const VIEW_KEY = "qs:jobsView";
function subscribeView(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  window.addEventListener("storage", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", cb);
  };
}
function useDefaultView(): "list" | "grid" {
  return useSyncExternalStore(
    subscribeView,
    () => {
      try {
        const saved = localStorage.getItem(VIEW_KEY);
        if (saved === "list" || saved === "grid") return saved;
      } catch {
        // storage unavailable
      }
      return window.matchMedia("(min-width: 1024px)").matches ? "list" : "grid";
    },
    () => "grid"
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsList />
    </Suspense>
  );
}

function JobsList() {
  const user = useSession();
  const showMoney = can.manageStudio(user.role);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dayKey = useDayKey();
  const today = toDateInput(new Date());

  // Filters live in the URL so refresh, back and "return from a job" keep them:
  // ?tab=history&range=custom&from=2026-10-01&to=2026-10-03&q=wb02
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "active";
  const statusParam = params.get("status") as JobStatus | null;
  const statusFilter: "all" | JobStatus = statusParam && ACTIVE_STATUSES.includes(statusParam) ? statusParam : "all";
  const preset: RangePreset = PRESETS.includes(params.get("range") as RangePreset) ? (params.get("range") as RangePreset) : "today";
  const customFrom = isDate(params.get("from")) ? params.get("from")! : today;
  const customTo = isDate(params.get("to")) ? params.get("to")! : today;

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );
  const setTab = (t: Tab) => setParams({ tab: t === "active" ? null : t });
  const setStatusFilter = (s: "all" | JobStatus) => setParams({ status: s === "all" ? null : s });
  const setPreset = (p: RangePreset) =>
    setParams(p === "custom" ? { range: p, from: customFrom, to: customTo } : { range: p === "today" ? null : p, from: null, to: null });

  const defaultView = useDefaultView();
  const view: "list" | "grid" = params.get("view") === "list" || params.get("view") === "grid" ? (params.get("view") as "list" | "grid") : defaultView;
  const setView = (v: "list" | "grid") => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage unavailable
    }
    setParams({ view: v });
  };
  const sort: SortKey = SORTS.includes(params.get("sort") as SortKey) ? (params.get("sort") as SortKey) : tab === "active" ? "old" : "new";
  const setSort = (k: SortKey) => setParams({ sort: k });
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const setFilters = (f: JobFilters) => setParams(filtersToParams(f));
  const [filterOpen, setFilterOpen] = useState(false);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  // Search updates the screen instantly and the URL shortly after typing stops
  const qParam = params.get("q") || "";
  const [search, setSearch] = useState(qParam);
  useEffect(() => {
    if (search === qParam) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null }), 400);
    return () => clearTimeout(t);
  }, [search, qParam, setParams]);

  // Remember this exact view for the job page's back arrow
  const listUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
  useEffect(() => {
    rememberListUrl(LIST_KEYS.jobs, listUrl);
  }, [listUrl]);

  const url = useMemo(() => {
    if (tab === "active") return "/api/service-entry?view=active";
    if (tab === "due") return "/api/service-entry?view=due";
    const range =
      preset === "custom"
        ? { from: fromDateInput(customFrom), to: endOfDay(fromDateInput(customTo)) }
        : rangeFor(preset as Exclude<RangePreset, "custom">);
    return `/api/service-entry?${rangeQuery(range)}`;
    // dayKey: "today" / "yesterday" move to the new day after midnight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, preset, customFrom, customTo, dayKey]);

  const { data, loading, error, reload } = useApi<Job[]>(url);
  const services = useApi<Service[]>("/api/services?all=1");
  const team = useApi<TeamMember[]>("/api/users?lite=1");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const compactQ = q.replace(/[^a-z0-9]/g, "");
    return (data || []).filter((job) => {
      if (tab === "active" && statusFilter !== "all" && job.status !== statusFilter) return false;
      if (!q) return true;
      const b = job.bikeId;
      return (
        (compactQ && b?.bikeNumber?.toLowerCase().replace(/[^a-z0-9]/g, "").includes(compactQ)) ||
        b?.ownerName?.toLowerCase().includes(q) ||
        b?.phone?.includes(q) ||
        b?.model?.toLowerCase().includes(q) ||
        String(job.jobNo || "").includes(q.replace("#", ""))
      );
    });
  }, [data, search, statusFilter, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length || 0 };
    for (const s of ACTIVE_STATUSES) c[s] = (data || []).filter((j) => j.status === s).length;
    return c;
  }, [data]);

  // flat rows → advanced filters → sort; totals and export use exactly these rows
  const rows = useMemo(() => sortRows(applyFilters(filtered.map(toRow), filters), sort), [filtered, filters, sort]);
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const nFilters = activeFilterCount(filters);

  const doExport = async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const span =
        tab === "history"
          ? preset === "custom"
            ? `${customFrom}_to_${customTo}`
            : (() => {
                const r = rangeFor(preset as Exclude<RangePreset, "custom">);
                return `${toDateInput(r.from)}_to_${toDateInput(r.to)}`;
              })()
          : tab === "due"
            ? "dues"
            : "in-studio";
      await exportJobsToExcel(rows, `quick-shine-jobs-${span}.xlsx`);
      toast(`Exported ${rows.length} jobs`);
    } catch (e) {
      toast((e as Error).message || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "active", label: "In studio" },
    { value: "history", label: "History" },
    { value: "due", label: "Dues" },
  ];

  return (
    <Page
      wide={view === "list" ? "full" : true}
      title="Jobs"
      actions={
        <Link href="/dashboard/service-entry/add" className={buttonClass("primary", "sm", "max-lg:hidden")}>
          <Plus className="size-4" /> New job
        </Link>
      }
    >
      <div className="space-y-3">
        <Segmented options={tabs} value={tab} onChange={setTab} />

        {tab === "active" && (
          <Chips
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              ...ACTIVE_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].short, count: counts[s] })),
            ]}
          />
        )}

        {tab === "history" && (
          <>
            <Chips
              value={preset}
              onChange={setPreset}
              options={PRESETS.map((p) => ({
                value: p,
                label: p === "custom" ? "Date range" : RANGE_LABEL[p],
              }))}
            />
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => e.target.value && setParams({ from: e.target.value })}
                />
                <Input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => e.target.value && setParams({ to: e.target.value })}
                />
              </div>
            )}
          </>
        )}

        <SearchInput value={search} onChange={setSearch} placeholder="Bike number, owner, phone, job #" />

        {/* Toolbar: view, sort, filters, export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="View">
            {(
              [
                ["list", List, "List"],
                ["grid", LayoutGrid, "Grid"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
                  view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort" className="h-11 text-sm">
              {SORTS.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <Button variant={nFilters ? "secondary" : "outline"} icon={<SlidersHorizontal className="size-4" />} onClick={() => setFilterOpen(true)}>
            Filters
            {nFilters > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{nFilters}</span>}
          </Button>
          {showMoney && (
            <Button variant="outline" icon={<Download className="size-4" />} loading={exporting} disabled={!rows.length} onClick={doExport}>
              <span className="max-sm:hidden">Export</span> Excel
            </Button>
          )}
        </div>

        {/* Active filters */}
        {nFilters > 0 && (
          <ActiveFilters filters={filters} onChange={setFilters} services={services.data || []} team={team.data || []} />
        )}

        {/* Summary strip — always matches what's listed */}
        {data && rows.length > 0 && (
          <div className="rounded-2xl bg-brand-50 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white px-2 py-2">
                <p className="text-[11px] font-medium text-slate-500">Cash (offline)</p>
                <p className="font-bold tabular-nums text-slate-900">{inr(totals.cash)}</p>
              </div>
              <div className="rounded-xl bg-white px-2 py-2">
                <p className="text-[11px] font-medium text-slate-500">Online</p>
                <p className="font-bold tabular-nums text-slate-900">{inr(totals.online)}</p>
              </div>
              <div className="rounded-xl bg-brand-600 px-2 py-2 text-white">
                <p className="text-[11px] font-medium text-white/70">Total</p>
                <p className="font-bold tabular-nums">{inr(totals.cash + totals.online)}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 px-1 text-xs text-brand-800">
              <span className="font-medium">
                {rows.length} job(s){nFilters || search ? ` of ${data.length}` : ""}
              </span>
              <span className="tabular-nums">
                {showMoney && <>Billed {inr(totals.total)}</>}
                {totals.discount > 0 && <span className="ml-2 text-emerald-700">Discount {inr(totals.discount)}</span>}
                {totals.due > 0 && <span className="ml-2 font-semibold text-red-600">{inr(totals.due)} due</span>}
              </span>
            </div>
          </div>
        )}

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title={
                search || nFilters
                  ? "No matching jobs"
                  : tab === "due"
                    ? "No pending dues 🎉"
                    : tab === "active"
                      ? "No bikes in the studio"
                      : "No jobs in this period"
              }
              text={tab === "active" && !search && !nFilters ? "New jobs you create will show here until they're delivered." : undefined}
              action={
                nFilters ? (
                  <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                ) : tab === "active" && !search ? (
                  <Link href="/dashboard/service-entry/add" className={buttonClass("primary")}>
                    <Plus className="size-4" /> New job
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : view === "list" ? (
          <>
            <div className="max-lg:hidden">
              <JobTable rows={rows} totals={totals} sort={sort} onSort={setSort} />
            </div>
            <Card className="divide-y divide-slate-100 overflow-hidden lg:hidden">
              {rows.map((r) => (
                <JobListRow key={r.id} row={r} />
              ))}
            </Card>
          </>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rows.map((r) => (
              <JobGridCard key={r.id} row={r} />
            ))}
          </div>
        )}

        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={filters}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
          services={services.data || []}
          team={team.data || []}
        />
      </div>
    </Page>
  );
}

/* ───────────── Advanced filters ───────────── */

const PAY_OPTS: { value: PayKind; label: string }[] = [
  { value: "cash", label: "Cash only" },
  { value: "online", label: "Online only" },
  { value: "mixed", label: "Cash + Online" },
  { value: "unpaid", label: "Unpaid" },
];
const PSTATE_OPTS: { value: PayState; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partly paid" },
  { value: "due", label: "Due" },
];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function ChipToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-9 rounded-full border px-3 text-sm font-medium transition",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function FilterSheet({
  open,
  onClose,
  filters,
  onApply,
  services,
  team,
}: {
  open: boolean;
  onClose: () => void;
  filters: JobFilters;
  onApply: (f: JobFilters) => void;
  services: Service[];
  team: TeamMember[];
}) {
  const [f, setF] = useState<JobFilters>(filters);
  const [shownFor, setShownFor] = useState(false);
  // start from the current filters each time the sheet opens
  if (open !== shownFor) {
    setShownFor(open);
    if (open) setF(filters);
  }
  const n = activeFilterCount(f);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter jobs"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" disabled={!n} onClick={() => setF(EMPTY_FILTERS)}>
            Clear
          </Button>
          <Button size="lg" className="flex-1" onClick={() => onApply(f)}>
            Show results{n ? ` (${n} filter${n > 1 ? "s" : ""})` : ""}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Payment">
          <div className="flex flex-wrap gap-2">
            {PAY_OPTS.map((o) => (
              <ChipToggle key={o.value} on={f.pay.includes(o.value)} onClick={() => setF({ ...f, pay: toggle(f.pay, o.value) })}>
                {o.label}
              </ChipToggle>
            ))}
          </div>
        </Field>
        <Field label="Payment status">
          <div className="flex flex-wrap gap-2">
            {PSTATE_OPTS.map((o) => (
              <ChipToggle key={o.value} on={f.pstate.includes(o.value)} onClick={() => setF({ ...f, pstate: toggle(f.pstate, o.value) })}>
                {o.label}
              </ChipToggle>
            ))}
          </div>
        </Field>
        <Field label="Bill amount (₹)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Min"
              value={f.min ?? ""}
              onChange={(e) => setF({ ...f, min: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Max"
              value={f.max ?? ""}
              onChange={(e) => setF({ ...f, max: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </Field>
        <Field label="Services">
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <ChipToggle key={s._id} on={f.svc.includes(s._id)} onClick={() => setF({ ...f, svc: toggle(f.svc, s._id) })}>
                {s.name}
                {s.isActive ? "" : " (old)"}
              </ChipToggle>
            ))}
          </div>
          {f.svc.length > 1 && (
            <Segmented
              size="sm"
              className="mt-2"
              value={f.svcAll ? "all" : "any"}
              onChange={(v) => setF({ ...f, svcAll: v === "all" })}
              options={[
                { value: "any", label: "Any of these" },
                { value: "all", label: "All of these" },
              ]}
            />
          )}
        </Field>
        <Field label="Job status">
          <div className="flex flex-wrap gap-2">
            {JOB_STATUSES.map((s) => (
              <ChipToggle key={s} on={f.st.includes(s)} onClick={() => setF({ ...f, st: toggle(f.st, s) })}>
                {STATUS_META[s].short}
              </ChipToggle>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Done by">
            <Select value={f.doneBy} onChange={(e) => setF({ ...f, doneBy: e.target.value })}>
              <option value="">Anyone</option>
              {team.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Money collected by">
            <Select value={f.coll} onChange={(e) => setF({ ...f, coll: e.target.value })}>
              <option value="">Anyone</option>
              {team.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Discount">
          <Segmented
            value={f.disc || "any"}
            onChange={(v) => setF({ ...f, disc: v === "any" ? "" : (v as "yes" | "no") })}
            options={[
              { value: "any", label: "Any" },
              { value: "yes", label: "With discount" },
              { value: "no", label: "No discount" },
            ]}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function ActiveFilters({ filters: f, onChange, services, team }: { filters: JobFilters; onChange: (f: JobFilters) => void; services: Service[]; team: TeamMember[] }) {
  const name = (id: string, list: { _id: string; name: string }[]) => list.find((x) => x._id === id)?.name || "…";
  const chips: { label: string; clear: JobFilters }[] = [];
  if (f.pay.length) chips.push({ label: f.pay.map((p) => PAY_OPTS.find((o) => o.value === p)?.label).join(" / "), clear: { ...f, pay: [] } });
  if (f.pstate.length) chips.push({ label: f.pstate.map((p) => PSTATE_OPTS.find((o) => o.value === p)?.label).join(" / "), clear: { ...f, pstate: [] } });
  if (f.min !== null || f.max !== null)
    chips.push({
      label: f.min !== null && f.max !== null ? `₹${f.min} – ₹${f.max}` : f.min !== null ? `≥ ₹${f.min}` : `≤ ₹${f.max}`,
      clear: { ...f, min: null, max: null },
    });
  if (f.svc.length) chips.push({ label: f.svc.map((id) => name(id, services)).join(f.svcAll ? " + " : " / "), clear: { ...f, svc: [], svcAll: false } });
  if (f.st.length) chips.push({ label: f.st.map((s) => STATUS_META[s].short).join(" / "), clear: { ...f, st: [] } });
  if (f.doneBy) chips.push({ label: `Done by ${name(f.doneBy, team)}`, clear: { ...f, doneBy: "" } });
  if (f.coll) chips.push({ label: `Collected by ${name(f.coll, team)}`, clear: { ...f, coll: "" } });
  if (f.disc) chips.push({ label: f.disc === "yes" ? "With discount" : "No discount", clear: { ...f, disc: "" } });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onChange(c.clear)}
          className="flex h-8 items-center gap-1 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100"
        >
          {c.label} <X className="size-3.5" />
        </button>
      ))}
      <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-xs font-semibold text-slate-500 underline">
        Clear all
      </button>
    </div>
  );
}
