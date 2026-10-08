"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Coffee, LogIn, LogOut, MapPin } from "lucide-react";
import { api, useApi } from "@/app/lib/api";
import { getPosition } from "@/app/lib/geo";
import { breakHours, fmtHours, openBreak, shiftHours, workStatus, workedSoFar, type WorkStatus } from "@/app/lib/attendanceShared";
import { fmtTime, rangeFor, rangeQuery } from "@/app/lib/format";
import type { PaySettings, Shift } from "@/app/lib/types";
import { useToast } from "./overlays";
import { useSession } from "./AppShell";
import { can } from "@/app/lib/roles";
import { Badge, Button, Card, cn } from "./ui";

export type MyAttendance = {
  today: Shift | null;
  todayKey: string;
  records: Shift[];
  unclosed: string | null;
  shop: { configured: boolean; radius?: number; label?: string };
  pay: PaySettings | null;
  summary: { days: number; hours: number; open: number; earned: number };
};

export function useMyAttendance(query?: string) {
  const fallback = useMemo(() => rangeQuery(rangeFor("today")), []);
  return useApi<MyAttendance>(`/api/attendance/me?${query || fallback}`);
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Sign in / sign out with GPS. `compact` is the dashboard version. */
type PunchAction = "in" | "out" | "break_start" | "break_end";

const PUNCH_DONE: Record<PunchAction, string> = {
  in: "Signed in — have a good day!",
  out: "Signed out — see you tomorrow",
  break_start: "Break started — you're shown as offline",
  break_end: "Welcome back — you're online again",
};

export function StatusPill({ status, since }: { status: WorkStatus; since?: string | Date }) {
  if (status === "online")
    return (
      <Badge tone="green">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Online
      </Badge>
    );
  if (status === "break") return <Badge tone="amber">On break{since ? ` since ${fmtTime(since)}` : ""}</Badge>;
  if (status === "out") return <Badge tone="gray">Signed out</Badge>;
  return <Badge tone="red">Not signed in</Badge>;
}

/** Sign in / break / sign out with GPS. `compact` is the dashboard version. */
export function PunchCard({ data, onChange, compact }: { data?: MyAttendance; onChange: () => void; compact?: boolean }) {
  const toast = useToast();
  const user = useSession();
  const now = useClock();
  const [busy, setBusy] = useState<"" | PunchAction>("");
  const [stage, setStage] = useState<"" | "locating" | "saving">("");
  const [problem, setProblem] = useState("");

  const today = data?.today;
  const status = workStatus(today);
  const onBreak = openBreak(today);

  const punch = async (action: PunchAction) => {
    setProblem("");
    setBusy(action);
    try {
      setStage("locating");
      const pos = await getPosition();
      setStage("saving");
      await api("/api/attendance/punch", { method: "POST", body: { action, ...pos } });
      toast(PUNCH_DONE[action]);
      onChange();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy("");
      setStage("");
    }
  };

  const label = (action: PunchAction, idle: string) =>
    busy === action ? (stage === "locating" ? "Checking location…" : "Saving…") : idle;

  if (!data) {
    return <Card className={cn("animate-pulse p-5", compact ? "h-24" : "h-48")} />;
  }

  const worked = today ? workedSoFar(today, now) : 0;
  const breakTotal = today ? breakHours(today, today.signOut ? new Date(today.signOut.at) : now) : 0;
  const tint = status === "online" ? "bg-emerald-50" : status === "break" ? "bg-amber-50" : status === "out" ? "bg-slate-50" : "bg-white";

  return (
    <Card className={cn("overflow-hidden", !compact && "rounded-3xl")}>
      <div className={cn("p-5", tint)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attendance · {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {status === "out"
                ? "Shift finished"
                : status === "break"
                  ? `On break since ${fmtTime(onBreak!.start.at)}`
                  : status === "online"
                    ? `Signed in at ${fmtTime(today!.signIn.at)}`
                    : "Not signed in yet"}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {status === "out"
                ? `${fmtTime(today!.signIn.at)} – ${fmtTime(today!.signOut!.at)} · worked ${fmtHours(worked)}`
                : status === "break"
                  ? `Away ${fmtHours((now.getTime() - new Date(onBreak!.start.at).getTime()) / 3_600_000)} · worked ${fmtHours(worked)} today`
                  : status === "online"
                    ? `Worked ${fmtHours(worked)} so far`
                    : `It's ${fmtTime(now)} — sign in when you reach the shop`}
              {breakTotal > 0 && status !== "break" ? ` · breaks ${fmtHours(breakTotal)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-2xl",
                status === "online" ? "bg-emerald-100 text-emerald-700" : status === "break" ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-600"
              )}
            >
              {status === "break" ? <Coffee className="size-5" /> : <Clock className="size-5" />}
            </span>
            {status !== "absent" && <StatusPill status={status} />}
          </div>
        </div>

        {!data.shop.configured ? (
          can.editHistory(user.role) ? (
            <Link href="/dashboard/attendance/team?tab=location" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white">
              <MapPin className="size-5" /> Set shop location to turn on sign-in
            </Link>
          ) : (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Sign-in is off until the Super Admin sets the shop location.</p>
          )
        ) : status === "absent" ? (
          <Button size="lg" variant="success" className="mt-4 w-full" loading={busy === "in"} disabled={!!busy} icon={busy !== "in" && <LogIn className="size-5" />} onClick={() => punch("in")}>
            {label("in", "Sign in")}
          </Button>
        ) : status === "break" ? (
          <Button size="lg" variant="success" className="mt-4 w-full" loading={busy === "break_end"} disabled={!!busy} icon={busy !== "break_end" && <LogIn className="size-5" />} onClick={() => punch("break_end")}>
            {label("break_end", "Back from break")}
          </Button>
        ) : status === "online" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" className="border-amber-200 text-amber-700" loading={busy === "break_start"} disabled={!!busy} icon={busy !== "break_start" && <Coffee className="size-5" />} onClick={() => punch("break_start")}>
              {label("break_start", "Start break")}
            </Button>
            <Button size="lg" variant="outline" className="border-red-200 text-red-700" loading={busy === "out"} disabled={!!busy} icon={busy !== "out" && <LogOut className="size-5" />} onClick={() => punch("out")}>
              {label("out", "Sign out")}
            </Button>
          </div>
        ) : null}

        {problem && (
          <p className="mt-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {problem}
          </p>
        )}
        {data.unclosed && (
          <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            You didn&apos;t sign out on {new Date(data.unclosed).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. Only the Super Admin can correct it.
          </p>
        )}
        {data.shop.configured && !compact && status !== "out" && (
          <p className="mt-3 text-center text-xs text-slate-400">
            {status === "online"
              ? "Going out (lunch, home)? Tap Start break before you leave, and Back from break when you return — both at the shop."
              : `Works only inside the shop (within ${data.shop.radius} m) — your GPS is checked.`}
          </p>
        )}
        {compact && (
          <Link href="/dashboard/attendance" className="mt-3 block text-center text-sm font-semibold text-brand-600">
            My attendance & hours
          </Link>
        )}
      </div>
    </Card>
  );
}

export function ShiftRow({ shift, name, onClick }: { shift: Shift; name?: string; onClick?: () => void }) {
  const hours = shiftHours(shift);
  const body = (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 shrink-0 text-center">
        <p className="text-lg font-bold leading-none text-slate-900">{Number(shift.date.slice(8))}</p>
        <p className="text-[11px] text-slate-500">{new Date(`${shift.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</p>
      </div>
      <div className="min-w-0 flex-1">
        {name && <p className="truncate text-sm font-semibold text-slate-800">{name}</p>}
        <p className="text-sm tabular-nums text-slate-700">
          {fmtTime(shift.signIn.at)} – {shift.signOut ? fmtTime(shift.signOut.at) : <span className="font-semibold text-amber-600">no sign-out</span>}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {!!shift.breaks?.length && (
            <Badge tone="amber">
              <Coffee className="size-3" /> {shift.breaks.length} break{shift.breaks.length > 1 ? "s" : ""} · {fmtHours(breakHours(shift, shift.signOut ? new Date(shift.signOut.at) : new Date()))}
            </Badge>
          )}
          {shift.manual && <Badge tone="violet">Corrected{shift.editedBy?.name ? ` by ${shift.editedBy.name}` : ""}</Badge>}
          {shift.signIn.distance !== undefined && <Badge>{shift.signIn.distance} m from shop</Badge>}
          {shift.note && <span className="truncate text-xs text-slate-500">“{shift.note}”</span>}
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{shift.signOut ? fmtHours(hours) : "—"}</span>
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left active:bg-slate-50">
      {body}
    </button>
  ) : (
    body
  );
}
