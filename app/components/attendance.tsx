"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { api, useApi } from "@/app/lib/api";
import { getPosition } from "@/app/lib/geo";
import { fmtHours, shiftHours } from "@/app/lib/attendanceShared";
import { fmtTime, rangeFor, rangeQuery } from "@/app/lib/format";
import type { PaySettings, Shift } from "@/app/lib/types";
import { useToast } from "./overlays";
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
export function PunchCard({ data, onChange, compact }: { data?: MyAttendance; onChange: () => void; compact?: boolean }) {
  const toast = useToast();
  const now = useClock();
  const [busy, setBusy] = useState<"" | "locating" | "saving">("");
  const [problem, setProblem] = useState("");

  const today = data?.today;
  const signedIn = !!today?.signIn && !today?.signOut;
  const finished = !!today?.signOut;
  const action: "in" | "out" = signedIn ? "out" : "in";

  const punch = async () => {
    setProblem("");
    try {
      setBusy("locating");
      const pos = await getPosition();
      setBusy("saving");
      await api("/api/attendance/punch", { method: "POST", body: { action, ...pos } });
      toast(action === "in" ? "Signed in — have a good day!" : "Signed out — see you tomorrow");
      onChange();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const worked = today ? (finished ? shiftHours(today) : (now.getTime() - new Date(today.signIn.at).getTime()) / 3_600_000) : 0;

  if (!data) {
    return <Card className={cn("animate-pulse p-5", compact ? "h-24" : "h-48")} />;
  }

  return (
    <Card className={cn("overflow-hidden", !compact && "rounded-3xl")}>
      <div className={cn("p-5", signedIn ? "bg-emerald-50" : finished ? "bg-slate-50" : "bg-white")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance · {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {finished ? "Shift finished" : signedIn ? `Signed in at ${fmtTime(today!.signIn.at)}` : "Not signed in yet"}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {finished
                ? `${fmtTime(today!.signIn.at)} – ${fmtTime(today!.signOut!.at)} · ${fmtHours(worked)}`
                : signedIn
                  ? `Working ${fmtHours(worked)} so far`
                  : `It's ${fmtTime(now)} — sign in when you reach the shop`}
            </p>
          </div>
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", signedIn ? "bg-emerald-100 text-emerald-700" : "bg-brand-50 text-brand-600")}>
            <Clock className="size-5" />
          </span>
        </div>

        {!data.shop.configured ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The shop location isn&apos;t set yet, so sign-in is off. The Super Admin can set it in Team attendance → Shop location.
          </p>
        ) : !finished ? (
          <Button
            size="lg"
            variant={signedIn ? "outline" : "success"}
            className={cn("mt-4 w-full", signedIn && "border-red-200 text-red-700")}
            loading={!!busy}
            icon={!busy && (signedIn ? <LogOut className="size-5" /> : <LogIn className="size-5" />)}
            onClick={punch}
          >
            {busy === "locating" ? "Checking your location…" : busy === "saving" ? "Saving…" : signedIn ? "Sign out" : "Sign in"}
          </Button>
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
        {data.shop.configured && !compact && !finished && (
          <p className="mt-3 text-center text-xs text-slate-400">Works only inside the shop (within {data.shop.radius} m) — your GPS is checked.</p>
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
