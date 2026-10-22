"use client";

import { useMemo, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { PeriodPicker, usePeriod } from "@/app/components/PeriodPicker";
import { Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, ListSkeleton, Page, Select, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { fmtDate, fmtTime, inr, rangeQuery } from "@/app/lib/format";
import { ROLE_LABEL, type Role } from "@/app/lib/roles";

type Entry = {
  _id: string;
  at: string;
  user?: string;
  name?: string;
  role?: Role;
  method: string;
  path: string;
  status: number;
  area: string;
  action?: string;
  detail?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  ip?: string;
  device?: string;
};

const AREAS = [
  { value: "", label: "Everything" },
  { value: "jobs", label: "Jobs & bikes" },
  { value: "money", label: "Money" },
  { value: "attendance", label: "Attendance" },
  { value: "stock", label: "Stock & services" },
  { value: "team", label: "Team" },
  { value: "signin", label: "Sign-in" },
  { value: "settings", label: "Other" },
];

const STATUS_WORD: Record<string, string> = { pending: "Waiting", in_progress: "In progress", completed: "Ready", delivered: "Delivered" };

const money = (v: unknown) => (typeof v === "number" || (typeof v === "string" && v !== "") ? inr(Number(v)) : "");
const job = (e: Entry) => (e.result?.jobNo ? `job #${e.result.jobNo}` : "a job");

/** One readable line for a log entry. */
function describe(e: Entry): string {
  const d = (e.detail || {}) as Record<string, unknown>;
  const r = (e.result || {}) as Record<string, unknown>;
  const p = e.path.replace(/\/[0-9a-f]{24}/g, "/:id");
  const key = `${e.method} ${p}`;
  switch (key) {
    case "LOGIN /api/login":
      return (
        { login: "Signed in", login_failed: `Wrong password for ${d.email}`, login_locked: `Blocked — too many wrong passwords (${d.email})`, login_disabled: "Tried to sign in, but the account is disabled" }[
          e.action || "login"
        ] || "Sign-in"
      ) + (d.client === "app" ? " (app)" : "");
    case "LOGOUT /api/logout":
      return "Signed out";
    case "POST /api/service-entry":
      return `Created ${job(e)}${r.total !== undefined ? ` · ${money(r.total)}` : ""}`;
    case "PATCH /api/service-entry/:id":
      if (d.action === "status") return `Moved ${job(e)} to ${STATUS_WORD[String(d.status)] || d.status}`;
      if (d.action === "pay") return `Took ${money(d.amount)} ${d.mode === "online" ? "online" : "cash"} on ${job(e)}`;
      if (d.action === "edit") return `Corrected ${job(e)} (dates / services / payments)`;
      return `Updated ${job(e)}`;
    case "DELETE /api/service-entry/:id":
      return "Deleted a job";
    case "POST /api/bikes":
      return `Added bike ${r.bikeNumber || d.bikeNumber || ""}`;
    case "PUT /api/bikes/:id":
      return `Updated bike ${r.bikeNumber || ""}`;
    case "DELETE /api/bikes/:id":
      return "Deleted a bike";
    case "POST /api/expenses":
      return `Recorded expense “${d.title}” ${money(d.amount)} (${d.mode === "online" ? "online" : "cash"})`;
    case "PUT /api/expenses/:id":
      return `Edited expense “${r.title || d.title || ""}”`;
    case "DELETE /api/expenses/:id":
      return "Deleted an expense";
    case "POST /api/cash/handover":
      return `Asked to hand over ${money(d.amount)} cash`;
    case "PATCH /api/cash/handover/:id":
      return { approve: "Approved a cash handover", reject: "Rejected a cash handover", cancel: "Cancelled a cash handover" }[String(d.action)] || "Updated a handover";
    case "POST /api/payroll":
      return `Paid salary ${money(d.amount)} (${d.mode === "online" ? "online" : "cash"})`;
    case "PUT /api/payroll":
      return `Set a pay rate: ${money(d.rate)} ${d.type === "daily" ? "per day" : d.type === "hourly" ? "per hour" : "per month"}`;
    case "POST /api/users":
      return `Added team member ${d.name || r.name || ""}`;
    case "PUT /api/users/:id":
      return `Updated ${r.name || "a team member"}${d.password ? " (reset password)" : ""}${d.role ? ` · role ${ROLE_LABEL[d.role as Role] || d.role}` : ""}${d.status ? ` · ${d.status}` : ""}`;
    case "DELETE /api/users/:id":
      return "Removed a team member";
    case "PUT /api/profile":
      return d.newPassword ? "Changed own password" : "Updated own profile";
    case "PUT /api/permissions":
      return d.reset ? "Reset permissions to standard" : "Changed permissions";
    case "POST /api/inventory":
      return `Added stock item ${d.name || ""}`;
    case "PUT /api/inventory/:id":
      return `Edited stock item ${r.name || ""}`;
    case "DELETE /api/inventory/:id":
      return "Deleted a stock item";
    case "POST /api/inventory/:id/stock":
      return `Stock ${d.type === "in" ? "in" : d.type === "out" ? "out" : "count"}: ${d.qty ?? ""} · ${r.name || ""}`;
    case "POST /api/inventory/categories":
      return `Added stock category ${d.label || ""}`;
    case "DELETE /api/inventory/categories":
      return "Removed a stock category";
    case "POST /api/services":
      return `Added service ${d.name || ""} ${money(d.price)}`;
    case "PUT /api/services/:id":
      return `Changed service ${r.name || d.name || ""}${d.price !== undefined ? ` · ${money(d.price)}` : ""}`;
    case "DELETE /api/services/:id":
      return "Deleted a service";
    case "POST /api/attendance/punch":
      return { in: "Signed in at the shop", out: "Signed out at the shop", break_start: "Went on break", break_end: "Back from break" }[String(d.action)] || "Attendance";
    case "POST /api/attendance":
      return "Added an attendance entry";
    case "PUT /api/attendance/:id":
      return "Corrected an attendance entry";
    case "DELETE /api/attendance/:id":
      return "Deleted an attendance entry";
    case "PUT /api/attendance/location":
      return "Set the shop location";
    case "POST /api/import/jobs":
      return d.dryRun ? "Checked an import file" : "Imported old jobs";
    case "DELETE /api/import/:id":
      return "Undid an import";
    default:
      return `${e.method} ${e.path}`;
  }
}

function deviceName(ua?: string) {
  if (!ua) return "";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return [os, browser].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

export default function ActivityClient() {
  const period = usePeriod("today");
  const [person, setPerson] = useState("");
  const [area, setArea] = useState("");
  const people = useApi<{ _id: string; name: string; role: Role; status: string }[]>("/api/users");

  const query = `/api/activity?${rangeQuery(period.range)}${person ? `&user=${person}` : ""}${area ? `&area=${area}` : ""}`;
  const { data, setData, error, reload } = useApi<{ rows: Entry[]; more: boolean }>(query);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const loadMore = async () => {
    if (!data?.rows.length) return;
    setLoadingMore(true);
    try {
      const next = await api<{ rows: Entry[]; more: boolean }>(`${query}&before=${encodeURIComponent(data.rows[data.rows.length - 1].at)}`);
      setData({ rows: [...data.rows, ...next.rows], more: next.more });
    } finally {
      setLoadingMore(false);
    }
  };

  const days = useMemo(() => {
    const out: { day: string; rows: Entry[] }[] = [];
    for (const r of data?.rows || []) {
      const day = fmtDate(r.at);
      if (out[out.length - 1]?.day !== day) out.push({ day, rows: [] });
      out[out.length - 1].rows.push(r);
    }
    return out;
  }, [data]);

  return (
    <Page title="Activity log" subtitle="Who did what — only you can see this" back="/dashboard/more">
      <PeriodPicker period={period} />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <Select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
            <option value="">Everyone</option>
            {(people.data || []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
                {u.status !== "Active" ? " (former)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <Chips value={area} onChange={setArea} options={AREAS} className="min-w-0 flex-1" />
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data ? (
          <ListSkeleton rows={6} />
        ) : data.rows.length === 0 ? (
          <Card>
            <EmptyState icon={<History />} title="Nothing recorded" text="Try another date range or person." />
          </Card>
        ) : (
          <>
            {days.map((g) => (
              <div key={g.day} className="mb-4">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.day}</p>
                <Card className="divide-y divide-slate-100">
                  {g.rows.map((e) => {
                    const refused = e.status >= 400;
                    const expanded = open === e._id;
                    return (
                      <div key={e._id}>
                        <button type="button" onClick={() => setOpen(expanded ? null : e._id)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                          <Avatar name={e.name || "?"} className="size-9 text-xs" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-900">
                              <span className="font-semibold">{e.name || "Unknown"}</span>
                              {e.role && <span className="text-xs text-slate-400"> · {ROLE_LABEL[e.role]}</span>}
                            </p>
                            <p className={cn("text-sm", refused ? "text-red-700" : "text-slate-600")}>{describe(e)}</p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {fmtTime(e.at)}
                              {e.device ? ` · ${deviceName(e.device)}` : ""}
                            </p>
                          </div>
                          {refused && <Badge tone="red">{e.status === 403 ? "Not allowed" : e.status === 429 ? "Blocked" : "Failed"}</Badge>}
                          <ChevronDown className={cn("mt-1 size-4 shrink-0 text-slate-300 transition", expanded && "rotate-180")} />
                        </button>
                        {expanded && (
                          <div className="space-y-1 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                            <p>
                              <b>Request:</b> {e.method} {e.path} → {e.status}
                            </p>
                            {e.ip && (
                              <p>
                                <b>IP:</b> {e.ip}
                              </p>
                            )}
                            {e.detail && Object.keys(e.detail).length > 0 && (
                              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 font-mono text-[11px]">{JSON.stringify(e.detail, null, 2)}</pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
            {data.more && (
              <Button variant="outline" className="w-full" loading={loadingMore} onClick={loadMore}>
                Load older
              </Button>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
