"use client";

import { useState } from "react";
import { Card, cn } from "./ui";
import { inr } from "@/app/lib/format";

export type Point = { key: string; billed: number; collected: number; expenses: number; jobs: number };
export type Report = {
  summary: {
    jobs: number;
    billed: number;
    discounts: number;
    avgTicket: number;
    collected: { cash: number; online: number; total: number };
    expenses: number;
    profit: number;
    cashflow: number;
    dues: { count: number; amount: number };
  };
  series: { unit: "day" | "month"; points: Point[] };
  services: { name: string; count: number; revenue: number }[];
  staff: { name: string; jobs: number; billed: number }[];
  expenseCategories: { category: string; amount: number }[];
};

const compactInr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${Math.round(n)}`;

/** Single-series bar chart of billed revenue; tap/hover a bar for that period's details. */
export function RevenueChart({ points, unit }: { points: Point[]; unit: "day" | "month" }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.billed));
  const active = selected !== null ? points[selected] : null;

  const labelOf = (key: string, long = false) => {
    const d = unit === "month" ? new Date(`${key}-01T00:00:00`) : new Date(`${key}T00:00:00`);
    return unit === "month"
      ? d.toLocaleDateString("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : undefined })
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: long ? "short" : undefined });
  };

  // Label only a handful of ticks so they never collide
  const every = Math.max(1, Math.ceil(points.length / 7));

  if (points.every((p) => p.billed === 0)) {
    return <Card className="p-8 text-center text-sm text-slate-500">No sales in this period</Card>;
  }

  return (
    <Card className="p-4">
      <div className="mb-3 min-h-11">
        {active ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm">
            <span className="font-semibold text-slate-900">{labelOf(active.key, true)}</span>
            <span className="text-slate-600">
              Billed <b className="tabular-nums text-slate-900">{inr(active.billed)}</b>
            </span>
            <span className="text-slate-600">
              Collected <b className="tabular-nums text-slate-900">{inr(active.collected)}</b>
            </span>
            <span className="text-slate-600">
              Expenses <b className="tabular-nums text-slate-900">{inr(active.expenses)}</b>
            </span>
            <span className="text-slate-600">
              Jobs <b className="tabular-nums text-slate-900">{active.jobs}</b>
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Peak {inr(max)} · tap a bar for details
          </p>
        )}
      </div>

      <div className="relative">
        {/* recessive gridlines at 50% and 100% */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-white pl-1 text-[10px] text-slate-400">{compactInr(max)}</span>

        <div className="flex h-44 items-end gap-[2px]" onMouseLeave={() => setSelected(null)}>
          {points.map((p, i) => (
            <button
              key={p.key}
              type="button"
              aria-label={`${labelOf(p.key, true)}: ${inr(p.billed)} billed`}
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(selected === i ? null : i)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  selected === i ? "bg-brand-700" : selected === null ? "bg-brand-500" : "bg-brand-200"
                )}
                style={{ height: p.billed > 0 ? `${Math.max(2, (p.billed / max) * 100)}%` : "2px", opacity: p.billed > 0 ? 1 : 0.3 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-slate-200 pt-1.5">
        {points.map((p, i) => (
          <span key={p.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-slate-400">
            {i % every === 0 ? labelOf(p.key) : ""}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function RankList({
  rows,
  empty,
  tone = "brand",
}: {
  rows: { label: string; value: number; detail?: string }[];
  empty: string;
  tone?: "brand" | "amber";
}) {
  if (rows.length === 0) return <Card className="p-6 text-center text-sm text-slate-500">{empty}</Card>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.label} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800">{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {r.detail && <span className="mr-2 text-xs text-slate-500">{r.detail}</span>}
              <b>{inr(r.value)}</b>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full", tone === "brand" ? "bg-brand-500" : "bg-amber-500")}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}
