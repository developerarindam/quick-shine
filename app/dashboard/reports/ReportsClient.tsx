"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Banknote, ClipboardList, Receipt, Smartphone, TrendingUp, Wallet } from "lucide-react";
import { Chips, ErrorState, Input, Page, SectionTitle, Skeleton, Stat, cn } from "@/app/components/ui";
import { RankList, RevenueChart, type Report } from "@/app/components/charts";
import { useApi } from "@/app/lib/api";
import {
  RANGE_LABEL,
  capitalize,
  endOfDay,
  fromDateInput,
  inr,
  rangeFor,
  rangeQuery,
  toDateInput,
  type RangePreset,
} from "@/app/lib/format";

export default function ReportsClient() {
  const [preset, setPreset] = useState<RangePreset>("month");
  const [custom, setCustom] = useState(() => ({ from: toDateInput(new Date(Date.now() - 29 * 86400000)), to: toDateInput(new Date()) }));

  const range = useMemo(
    () => (preset === "custom" ? { from: fromDateInput(custom.from), to: endOfDay(fromDateInput(custom.to)) } : rangeFor(preset)),
    [preset, custom]
  );
  const tz = new Date().getTimezoneOffset();
  const { data, loading, error, reload } = useApi<Report>(`/api/reports?${rangeQuery(range)}&tz=${tz}`);
  const s = data?.summary;

  return (
    <Page title="Reports" back="/dashboard/more" wide>
      <Chips
        value={preset}
        onChange={setPreset}
        options={(["today", "week", "month", "lastMonth", "custom"] as RangePreset[]).map((p) => ({ value: p, label: RANGE_LABEL[p] }))}
      />
      {preset === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          <Input type="date" aria-label="To" value={custom.to} min={custom.from} max={toDateInput(new Date())} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !s ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          {/* Headline */}
          <div className="mt-4 rounded-3xl bg-linear-to-br from-brand-600 to-brand-900 p-5 text-white">
            <p className="text-sm text-white/70">Profit · billed minus expenses</p>
            <p className={cn("mt-1 text-4xl font-bold tracking-tight tabular-nums", s.profit < 0 && "text-red-200")}>{inr(s.profit)}</p>
            <p className="mt-2 text-sm text-white/80">
              Cash in hand after expenses: <span className="font-semibold tabular-nums">{inr(s.cashflow)}</span>
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Billed" value={inr(s.billed)} sub={s.discounts ? `${inr(s.discounts)} discounts given` : undefined} icon={<TrendingUp className="size-4" />} />
            <Stat label="Collected" value={inr(s.collected.total)} icon={<Wallet className="size-4" />} tone="green" />
            <Stat label="Expenses" value={inr(s.expenses)} icon={<Receipt className="size-4" />} tone="amber" href="/dashboard/expenses" />
            <Stat label="Jobs" value={s.jobs} sub={`Avg ${inr(Math.round(s.avgTicket))} / job`} icon={<ClipboardList className="size-4" />} tone="violet" />
            <Stat label="Cash" value={inr(s.collected.cash)} icon={<Banknote className="size-4" />} tone="gray" />
            <Stat label="UPI / Online" value={inr(s.collected.online)} icon={<Smartphone className="size-4" />} tone="blue" />
            <Stat
              label="Outstanding dues"
              value={inr(s.dues.amount)}
              sub={`${s.dues.count} job(s) · all time`}
              icon={<AlertCircle className="size-4" />}
              tone="red"
              href="/dashboard/service-entry?tab=due"
            />
          </div>

          <SectionTitle>Revenue by {data.series.unit}</SectionTitle>
          <RevenueChart points={data.series.points} unit={data.series.unit} />

          <div className="grid gap-x-6 lg:grid-cols-2">
            <div>
              <SectionTitle>Top services</SectionTitle>
              <RankList
                empty="No services sold in this period"
                rows={data.services.slice(0, 10).map((x) => ({ label: x.name, value: x.revenue, detail: `${x.count}×` }))}
              />
            </div>
            <div>
              <SectionTitle>Team performance</SectionTitle>
              <RankList empty="No jobs in this period" rows={data.staff.map((x) => ({ label: x.name, value: x.billed, detail: `${x.jobs} job(s)` }))} />
            </div>
            <div>
              <SectionTitle>Expenses by category</SectionTitle>
              <RankList
                empty="No expenses in this period"
                tone="amber"
                rows={data.expenseCategories.map((x) => ({ label: capitalize(x.category), value: x.amount }))}
              />
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
