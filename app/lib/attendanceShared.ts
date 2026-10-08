// Attendance helpers shared by server and client.

export type PayType = "daily" | "hourly" | "monthly";

export const PAY_LABEL: Record<PayType, string> = {
  daily: "Per day",
  hourly: "Per hour",
  monthly: "Monthly salary",
};

type At = { at: string | Date };
export type BreakLike = { start: At; end?: At | null };
export type ShiftLike = { date: string; signIn: At; signOut?: At | null; breaks?: BreakLike[] };

const ms = (x: At) => new Date(x.at).getTime();

/** Total break time in hours; an open break counts up to `until` (default now). */
export function breakHours(s: ShiftLike, until: Date = new Date()) {
  return (s.breaks || []).reduce((sum, b) => sum + Math.max(0, (b.end ? ms(b.end) : until.getTime()) - ms(b.start)) / 3_600_000, 0);
}

/** Hours actually worked on a completed shift: sign-in → sign-out minus breaks (0 while still signed in). */
export function shiftHours(s: ShiftLike) {
  if (!s.signOut?.at) return 0;
  const gross = (ms(s.signOut) - ms(s.signIn)) / 3_600_000;
  return Math.max(0, gross - breakHours(s, new Date(s.signOut.at)));
}

/** Hours worked so far on a shift still in progress (excludes breaks). */
export function workedSoFar(s: ShiftLike, now: Date = new Date()) {
  if (s.signOut?.at) return shiftHours(s);
  return Math.max(0, (now.getTime() - ms(s.signIn)) / 3_600_000 - breakHours(s, now));
}

export type WorkStatus = "absent" | "online" | "break" | "out";

/** online = at work, break = stepped out (offline), out = signed out for the day */
export function workStatus(s?: ShiftLike | null): WorkStatus {
  if (!s) return "absent";
  if (s.signOut?.at) return "out";
  if ((s.breaks || []).some((b) => !b.end)) return "break";
  return "online";
}

export function openBreak(s?: ShiftLike | null) {
  return (s?.breaks || []).find((b) => !b.end) || null;
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
