"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { JobCard } from "@/app/components/jobs";
import { Card, Chips, EmptyState, ErrorState, Input, ListSkeleton, Page, SearchInput, Segmented, buttonClass } from "@/app/components/ui";
import { useApi, useDayKey } from "@/app/lib/api";
import { LIST_KEYS, rememberListUrl } from "@/app/lib/listState";
import { can } from "@/app/lib/roles";
import { ACTIVE_STATUSES, STATUS_META, balanceOf, paidOf, type JobStatus } from "@/app/lib/jobs";
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
import type { Job } from "@/app/lib/types";

type Tab = "active" | "history" | "due";

const TABS: Tab[] = ["active", "history", "due"];
const PRESETS: RangePreset[] = ["today", "yesterday", "week", "month", "custom"];
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

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

  const totalBilled = filtered.reduce((s, j) => s + j.total, 0);
  const totalDue = filtered.reduce((s, j) => s + balanceOf(j), 0);
  // money received on the jobs shown, split cash (offline) vs online
  const received = useMemo(() => {
    let cash = 0;
    let online = 0;
    for (const j of filtered) {
      if (j.payments.length) {
        for (const p of j.payments) {
          if (p.mode === "online") online += p.amount;
          else cash += p.amount;
        }
      } else {
        // entries from before payment tracking: paid in full at billing
        const paid = paidOf(j);
        if (j.paymentType === "online") online += paid;
        else cash += paid;
      }
    }
    return { cash, online, total: cash + online };
  }, [filtered]);

  const tabs: { value: Tab; label: string }[] = [
    { value: "active", label: "In studio" },
    { value: "history", label: "History" },
    { value: "due", label: "Dues" },
  ];

  return (
    <Page
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

        {/* Summary strip */}
        {data && filtered.length > 0 && (
          <div className="rounded-2xl bg-brand-50 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white px-2 py-2">
                <p className="text-[11px] font-medium text-slate-500">Cash (offline)</p>
                <p className="font-bold tabular-nums text-slate-900">{inr(received.cash)}</p>
              </div>
              <div className="rounded-xl bg-white px-2 py-2">
                <p className="text-[11px] font-medium text-slate-500">Online</p>
                <p className="font-bold tabular-nums text-slate-900">{inr(received.online)}</p>
              </div>
              <div className="rounded-xl bg-brand-600 px-2 py-2 text-white">
                <p className="text-[11px] font-medium text-white/70">Total</p>
                <p className="font-bold tabular-nums">{inr(received.total)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-brand-800">
              <span className="font-medium">{filtered.length} job(s)</span>
              <span className="tabular-nums">
                {showMoney && <>Billed {inr(totalBilled)}</>}
                {totalDue > 0 && <span className="ml-2 font-semibold text-red-600">{inr(totalDue)} due</span>}
              </span>
            </div>
          </div>
        )}

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title={search ? "No matching jobs" : tab === "due" ? "No pending dues 🎉" : tab === "active" ? "No bikes in the studio" : "No jobs in this period"}
              text={tab === "active" && !search ? "New jobs you create will show here until they're delivered." : undefined}
              action={
                tab === "active" && !search ? (
                  <Link href="/dashboard/service-entry/add" className={buttonClass("primary")}>
                    <Plus className="size-4" /> New job
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
