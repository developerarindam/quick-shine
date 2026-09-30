"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { JobCard } from "@/app/components/jobs";
import { Card, Chips, EmptyState, ErrorState, Input, ListSkeleton, Page, SearchInput, Segmented, buttonClass } from "@/app/components/ui";
import { useApi } from "@/app/lib/api";
import { can } from "@/app/lib/roles";
import { ACTIVE_STATUSES, STATUS_META, balanceOf, type JobStatus } from "@/app/lib/jobs";
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

  const initialTab = (params.get("tab") as Tab) || "active";
  const [tab, setTab] = useState<Tab>(["active", "history", "due"].includes(initialTab) ? initialTab : "active");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>((params.get("status") as JobStatus) || "all");
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customDay, setCustomDay] = useState(toDateInput(new Date()));
  const [search, setSearch] = useState("");

  const url = useMemo(() => {
    if (tab === "active") return "/api/service-entry?view=active";
    if (tab === "due") return "/api/service-entry?view=due";
    const range =
      preset === "custom"
        ? { from: fromDateInput(customDay), to: endOfDay(fromDateInput(customDay)) }
        : rangeFor(preset);
    return `/api/service-entry?${rangeQuery(range)}`;
  }, [tab, preset, customDay]);

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
              options={(["today", "yesterday", "week", "month", "custom"] as RangePreset[]).map((p) => ({
                value: p,
                label: RANGE_LABEL[p],
              }))}
            />
            {preset === "custom" && (
              <Input type="date" value={customDay} max={toDateInput(new Date())} onChange={(e) => e.target.value && setCustomDay(e.target.value)} />
            )}
          </>
        )}

        <SearchInput value={search} onChange={setSearch} placeholder="Bike number, owner, phone, job #" />

        {/* Summary strip */}
        {data && filtered.length > 0 && tab !== "active" && (
          <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm">
            <span className="font-medium text-brand-800">{filtered.length} job(s)</span>
            {showMoney && (
              <span className="font-semibold tabular-nums text-brand-800">
                {tab === "due" ? `${inr(totalDue)} to collect` : `${inr(totalBilled)} billed`}
              </span>
            )}
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
