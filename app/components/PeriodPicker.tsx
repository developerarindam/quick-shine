"use client";

import { useMemo, useState } from "react";
import { useDayKey } from "@/app/lib/api";
import { endOfDay, fromDateInput, rangeFor, toDateInput, type DateRange, type RangePreset } from "@/app/lib/format";
import { Chips, Input } from "./ui";

export type PeriodPreset = Extract<RangePreset, "today" | "week" | "last30" | "month" | "custom">;

const OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Weekly" },
  { value: "last30", label: "Monthly" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Date range" },
];

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: "today",
  week: "last 7 days",
  last30: "last 30 days",
  month: "this month",
  custom: "selected dates",
};

/**
 * Period state + range that rolls over automatically when the day changes.
 * Weekly = last 7 days, Monthly = last 30 days, This month = 1st → today.
 */
export function usePeriod(initial: PeriodPreset = "today") {
  const dayKey = useDayKey();
  const [preset, setPreset] = useState<PeriodPreset>(initial);
  const [custom, setCustom] = useState(() => {
    const today = toDateInput(new Date());
    return { from: today, to: today };
  });

  const range: DateRange = useMemo(
    () => (preset === "custom" ? { from: fromDateInput(custom.from), to: endOfDay(fromDateInput(custom.to)) } : rangeFor(preset)),
    // dayKey makes "today"-based ranges recompute after midnight
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom, dayKey]
  );

  return { preset, setPreset, custom, setCustom, range, dayKey };
}

export function PeriodPicker({ period, className }: { period: ReturnType<typeof usePeriod>; className?: string }) {
  const { preset, setPreset, custom, setCustom } = period;
  const today = toDateInput(new Date());
  return (
    <div className={className}>
      <Chips value={preset} onChange={setPreset} options={OPTIONS} />
      {preset === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input
            type="date"
            aria-label="From date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
          />
          <Input
            type="date"
            aria-label="To date"
            value={custom.to}
            min={custom.from}
            max={today}
            onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
