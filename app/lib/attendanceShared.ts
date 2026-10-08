// Attendance helpers shared by server and client.

export type PayType = "daily" | "hourly" | "monthly";

export const PAY_LABEL: Record<PayType, string> = {
  daily: "Per day",
  hourly: "Per hour",
  monthly: "Monthly salary",
};

export type ShiftLike = { date: string; signIn: { at: string | Date }; signOut?: { at: string | Date } | null };

/** Hours worked on a completed shift (0 while still signed in). */
export function shiftHours(s: ShiftLike) {
  if (!s.signOut?.at) return 0;
  return Math.max(0, (new Date(s.signOut.at).getTime() - new Date(s.signIn.at).getTime()) / 3_600_000);
}

export function fmtHours(h: number) {
  const mins = Math.round(h * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return hh ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

const daysInMonth = (dateKey: string) => {
  const [y, m] = dateKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * What a set of shifts earns.
 * daily   → rate × days present
 * hourly  → rate × hours on completed shifts
 * monthly → rate ÷ days-in-that-month for each day present (salary pro-rated by attendance)
 */
export function earningsFor(shifts: ShiftLike[], pay?: { type?: PayType; rate?: number } | null) {
  const days = shifts.length;
  const hours = shifts.reduce((s, x) => s + shiftHours(x), 0);
  const open = shifts.filter((x) => !x.signOut?.at).length;
  const rate = pay?.rate || 0;
  let earned = 0;
  if (pay?.type === "daily") earned = rate * days;
  else if (pay?.type === "hourly") earned = rate * hours;
  else if (pay?.type === "monthly") earned = shifts.reduce((s, x) => s + rate / daysInMonth(x.date), 0);
  return { days, hours, open, earned: Math.round(earned * 100) / 100 };
}
