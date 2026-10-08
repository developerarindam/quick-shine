"use client";

import { useMemo, useState } from "react";
import { Crosshair, ExternalLink, IndianRupee, MapPin, Pencil, Plus, Trash2, UserCheck, UserX, Wallet } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { ShiftRow } from "@/app/components/attendance";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import { PeriodPicker, usePeriod } from "@/app/components/PeriodPicker";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, MoneyInput, Page, SectionTitle, Segmented, Select, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { fmtHours, PAY_LABEL, shiftHours, type PayType } from "@/app/lib/attendanceShared";
import { fmtDate, fmtTime, fmtWhen, inr, rangeFor, rangeQuery, toDateTimeInput } from "@/app/lib/format";
import { getPosition, mapsLink } from "@/app/lib/geo";
import { ROLE_LABEL, can, type Role } from "@/app/lib/roles";
import type { PaySettings, Shift } from "@/app/lib/types";

type Member = { _id: string; name: string; role: Role };
type TeamData = { todayKey: string; records: Shift[]; board: { user: Member; today: Shift | null }[] };
type PayrollRow = {
  user: { _id: string; name: string; role: Role; status: string };
  pay: PaySettings | null;
  days: number;
  hours: number;
  open: number;
  earned: number;
  paid: number;
  balance: number;
  payments: { _id: string; amount: number; mode: string; date: string; note?: string }[];
};
type Tab = "today" | "register" | "payroll" | "location";

const nameOf = (s: Shift) => (typeof s.user === "object" ? s.user.name : "");

export default function TeamAttendanceClient() {
  const user = useSession();
  const superAdmin = can.editHistory(user.role);
  const [tab, setTab] = useState<Tab>("today");

  const tabs: { value: Tab; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "register", label: "Register" },
    ...(superAdmin
      ? [
          { value: "payroll" as Tab, label: "Payroll" },
          { value: "location" as Tab, label: "Location" },
        ]
      : []),
  ];

  return (
    <Page title="Team attendance" subtitle={superAdmin ? "Attendance, corrections & payroll" : "Who is at work"} back="/dashboard/attendance">
      <Segmented options={tabs} value={tab} onChange={setTab} size="sm" />
      <div className="mt-4">
        {tab === "today" && <TodayBoard />}
        {tab === "register" && <Register editable={superAdmin} />}
        {tab === "payroll" && superAdmin && <Payroll />}
        {tab === "location" && superAdmin && <ShopLocation />}
      </div>
    </Page>
  );
}

/* ───────────── Today ───────────── */

function TodayBoard() {
  const q = useMemo(() => rangeQuery(rangeFor("today")), []);
  const { data, error, reload } = useApi<TeamData>(`/api/attendance?${q}`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ListSkeleton rows={4} />;

  const present = data.board.filter((b) => b.today).length;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{data.board.filter((b) => b.today && !b.today.signOut).length}</p>
          <p className="text-xs text-slate-500">At work</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-slate-700">{data.board.filter((b) => b.today?.signOut).length}</p>
          <p className="text-xs text-slate-500">Left</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{data.board.length - present}</p>
          <p className="text-xs text-slate-500">Not in</p>
        </Card>
      </div>
      <Card className="mt-3 divide-y divide-slate-100">
        {data.board.map(({ user: m, today }) => (
          <div key={m._id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.name} className="size-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{m.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABEL[m.role]}</p>
            </div>
            {!today ? (
              <Badge tone="red">
                <UserX className="size-3" /> Not signed in
              </Badge>
            ) : !today.signOut ? (
              <div className="text-right">
                <Badge tone="green">
                  <UserCheck className="size-3" /> In since {fmtTime(today.signIn.at)}
                </Badge>
              </div>
            ) : (
              <div className="text-right text-xs text-slate-500">
                <p className="font-semibold tabular-nums text-slate-800">
                  {fmtTime(today.signIn.at)} – {fmtTime(today.signOut.at)}
                </p>
                <p>{fmtHours(shiftHours(today))}</p>
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}

/* ───────────── Register ───────────── */

function Register({ editable }: { editable: boolean }) {
  const period = usePeriod("week");
  const { data, error, reload } = useApi<TeamData>(`/api/attendance?${rangeQuery(period.range)}`);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [adding, setAdding] = useState(false);

  const byDate = useMemo(() => {
    const groups = new Map<string, Shift[]>();
    for (const r of data?.records || []) groups.set(r.date, [...(groups.get(r.date) || []), r]);
    return [...groups.entries()];
  }, [data]);

  return (
    <>
      <PeriodPicker period={period} />
      {editable && (
        <Button variant="secondary" className="mt-3 w-full" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Add a missed day
        </Button>
      )}
      <div className="mt-3">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data ? (
          <ListSkeleton rows={4} />
        ) : byDate.length === 0 ? (
          <Card>
            <EmptyState icon={<UserCheck />} title="No attendance in this period" />
          </Card>
        ) : (
          byDate.map(([date, shifts]) => (
            <div key={date}>
              <SectionTitle
                action={<span className="text-xs text-slate-500">{shifts.length} present · {fmtHours(shifts.reduce((s, x) => s + shiftHours(x), 0))}</span>}
              >
                {fmtDate(`${date}T00:00:00`)}
              </SectionTitle>
              <Card className="divide-y divide-slate-100">
                {shifts.map((s) => (
                  <ShiftRow key={s._id} shift={s} name={nameOf(s)} onClick={editable ? () => setEditing(s) : undefined} />
                ))}
              </Card>
            </div>
          ))
        )}
      </div>
      {editable && (
        <ShiftSheet
          open={!!editing || adding}
          shift={editing}
          team={(data?.board || []).map((b) => b.user)}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={reload}
        />
      )}
    </>
  );
}

function ShiftSheet({ open, shift, team, onClose, onSaved }: { open: boolean; shift: Shift | null; team: Member[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [userId, setUserId] = useState("");
  const [signIn, setSignIn] = useState("");
  const [signOut, setSignOut] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // load the form whenever a different shift (or "add") is opened
  const key = open ? shift?._id || "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setUserId(shift ? "" : team[0]?._id || "");
      const nineAm = new Date();
      nineAm.setHours(9, 0, 0, 0);
      setSignIn(toDateTimeInput(shift ? shift.signIn.at : nineAm));
      setSignOut(shift?.signOut ? toDateTimeInput(shift.signOut.at) : "");
      setNote(shift?.note || "");
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      const body = { signIn: new Date(signIn).toISOString(), signOut: signOut ? new Date(signOut).toISOString() : null, note };
      if (shift) await api(`/api/attendance/${shift._id}`, { method: "PUT", body });
      else await api("/api/attendance", { method: "POST", body: { ...body, userId } });
      toast(shift ? "Attendance corrected" : "Attendance added");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!shift) return;
    if (!(await confirm({ title: "Delete this attendance entry?", confirmText: "Delete", danger: true }))) return;
    try {
      await api(`/api/attendance/${shift._id}`, { method: "DELETE" });
      toast("Entry deleted");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={shift ? `Correct ${nameOf(shift)}` : "Add a missed day"}
      footer={
        <div className="flex gap-2">
          {shift && (
            <Button variant="danger" size="lg" onClick={remove} aria-label="Delete entry">
              <Trash2 className="size-5" />
            </Button>
          )}
          <Button size="lg" className="flex-1" loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!shift && (
          <Field label="Employee">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {team.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Signed in at">
          <Input type="datetime-local" value={signIn} max={toDateTimeInput(new Date())} onChange={(e) => e.target.value && setSignIn(e.target.value)} />
        </Field>
        <Field label="Signed out at" hint="Leave empty if they're still at work">
          <Input type="datetime-local" value={signOut} min={signIn} onChange={(e) => setSignOut(e.target.value)} />
        </Field>
        <Field label="Reason / note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Forgot to sign out" />
        </Field>
        {shift?.signIn.distance !== undefined && (
          <p className="text-xs text-slate-500">
            Original sign-in was {shift.signIn.distance} m from the shop
            {shift.signIn.lat !== undefined && (
              <>
                {" · "}
                <a className="font-semibold text-brand-600" href={mapsLink(shift.signIn.lat, shift.signIn.lng!)} target="_blank" rel="noreferrer">
                  see on map
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* ───────────── Payroll ───────────── */

function Payroll() {
  const period = usePeriod("month");
  const { data, error, reload } = useApi<{ rows: PayrollRow[]; totals: { earned: number; paid: number; balance: number } }>(
    `/api/payroll?${rangeQuery(period.range)}`
  );
  const [rateFor, setRateFor] = useState<PayrollRow | null>(null);
  const [payFor, setPayFor] = useState<PayrollRow | null>(null);

  return (
    <>
      <PeriodPicker period={period} />
      {error ? (
        <div className="mt-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <div className="mt-3">
          <ListSkeleton rows={3} />
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="font-bold tabular-nums text-slate-900">{inr(data.totals.earned)}</p>
              <p className="text-xs text-slate-500">Earned</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="font-bold tabular-nums text-emerald-600">{inr(data.totals.paid)}</p>
              <p className="text-xs text-slate-500">Paid</p>
            </Card>
            <Card className="p-3 text-center">
              <p className={cn("font-bold tabular-nums", data.totals.balance > 0 ? "text-red-600" : "text-slate-900")}>{inr(data.totals.balance)}</p>
              <p className="text-xs text-slate-500">To pay</p>
            </Card>
          </div>
          <div className="mt-3 space-y-3">
            {data.rows.map((r) => (
              <Card key={r.user._id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.user.name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{r.user.name}</p>
                    <button type="button" onClick={() => setRateFor(r)} className="flex items-center gap-1 text-xs font-medium text-brand-600">
                      {r.pay ? `${PAY_LABEL[r.pay.type]} · ${inr(r.pay.rate)}` : "Set pay rate"} <Pencil className="size-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-bold tabular-nums", r.balance > 0 ? "text-red-600" : "text-slate-900")}>{inr(r.balance)}</p>
                    <p className="text-[11px] text-slate-500">balance</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-4 divide-x divide-slate-100 rounded-xl bg-slate-50 py-2 text-center text-xs">
                  <div>
                    <dd className="font-bold text-slate-900">{r.days}</dd>
                    <dt className="text-slate-500">Days</dt>
                  </div>
                  <div>
                    <dd className="font-bold text-slate-900">{fmtHours(r.hours)}</dd>
                    <dt className="text-slate-500">Hours</dt>
                  </div>
                  <div>
                    <dd className="truncate px-1 font-bold tabular-nums text-slate-900">{inr(r.earned)}</dd>
                    <dt className="text-slate-500">Earned</dt>
                  </div>
                  <div>
                    <dd className="truncate px-1 font-bold tabular-nums text-emerald-600">{inr(r.paid)}</dd>
                    <dt className="text-slate-500">Paid</dt>
                  </div>
                </dl>
                {r.open > 0 && <p className="mt-2 text-xs text-amber-700">{r.open} day(s) have no sign-out — correct them in Register so hours count.</p>}
                {r.payments.length > 0 && (
                  <p className="mt-2 truncate text-xs text-slate-500">
                    Paid: {r.payments.map((p) => `${inr(p.amount)} ${p.mode} (${fmtDate(p.date)})`).join(", ")}
                  </p>
                )}
                <Button
                  variant="success"
                  className="mt-3 w-full"
                  icon={<Wallet className="size-4" />}
                  disabled={!r.pay && r.balance <= 0}
                  onClick={() => setPayFor(r)}
                >
                  Pay {r.balance > 0 ? inr(r.balance) : ""}
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs text-slate-500">
            Monthly salary is paid for days present (salary ÷ days in the month). Payments are saved as Salary expenses — cash payments also come out of
            your cash in hand.
          </p>
        </>
      )}
      <RateSheet row={rateFor} onClose={() => setRateFor(null)} onSaved={reload} />
      <PaySheet row={payFor} onClose={() => setPayFor(null)} onSaved={reload} />
    </>
  );
}

function RateSheet({ row, onClose, onSaved }: { row: PayrollRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<PayType>("daily");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((row?.user._id || null) !== lastId) {
    setLastId(row?.user._id || null);
    if (row) {
      setType(row.pay?.type || "daily");
      setRate(row.pay ? String(row.pay.rate) : "");
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/payroll", { method: "PUT", body: { userId: row!.user._id, type, rate: Number(rate) } });
      toast("Pay rate saved");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!row}
      onClose={onClose}
      title={`Pay rate · ${row?.user.name || ""}`}
      footer={
        <Button size="lg" className="w-full" loading={saving} disabled={rate === ""} onClick={save}>
          Save rate
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "daily", label: "Per day" },
            { value: "hourly", label: "Per hour" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
        <Field label={type === "daily" ? "Amount per day present" : type === "hourly" ? "Amount per hour worked" : "Monthly salary"}>
          <MoneyInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className="h-14 text-xl font-bold" autoFocus />
        </Field>
        <p className="text-xs text-slate-500">
          {type === "daily"
            ? "Each day they sign in counts as one day's pay."
            : type === "hourly"
              ? "Hours are counted from sign-in to sign-out."
              : "Paid for days present: salary ÷ days in the month × days present."}
        </p>
      </div>
    </Sheet>
  );
}

function PaySheet({ row, onClose, onSaved }: { row: PayrollRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((row?.user._id || null) !== lastId) {
    setLastId(row?.user._id || null);
    if (row) {
      setAmount(row.balance > 0 ? String(row.balance) : "");
      setNote("");
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/payroll", { method: "POST", body: { userId: row!.user._id, amount: Number(amount), mode, note } });
      toast(`${inr(Number(amount))} paid to ${row!.user.name}`);
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!row}
      onClose={onClose}
      title={`Pay ${row?.user.name || ""}`}
      footer={
        <Button size="lg" variant="success" className="w-full" loading={saving} disabled={!(Number(amount) > 0)} icon={<IndianRupee className="size-5" />} onClick={save}>
          Pay {inr(Number(amount) || 0)}
        </Button>
      }
    >
      <div className="space-y-4">
        {row && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Earned {inr(row.earned)} · already paid {inr(row.paid)} · balance <b>{inr(row.balance)}</b>
          </p>
        )}
        <Field label="Amount">
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-bold" />
        </Field>
        <Field label="Paid by">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "cash", label: "Cash" },
              { value: "online", label: "UPI / Online" },
            ]}
          />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Week 1 wages, advance" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ───────────── Shop location ───────────── */

type Shop = { lat: number; lng: number; radius: number; label?: string; updatedAt?: string } | null;

function ShopLocation() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Shop>("/api/attendance/location");
  const [draft, setDraft] = useState<{ lat: string; lng: string; radius: string; label: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const form = draft || {
    lat: data ? String(data.lat) : "",
    lng: data ? String(data.lng) : "",
    radius: data ? String(data.radius) : "100",
    label: data?.label || "",
  };
  const set = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });

  const useHere = async () => {
    setLocating(true);
    try {
      const p = await getPosition();
      set({ lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) });
      setAccuracy(p.accuracy);
      toast(`Location captured (±${p.accuracy} m)`, "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/attendance/location", { method: "PUT", body: { lat: Number(form.lat), lng: Number(form.lng), radius: Number(form.radius), label: form.label } });
      toast("Shop location saved — staff can now sign in here");
      setDraft(null);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && data === undefined) return <ListSkeleton rows={2} />;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", data ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            <MapPin className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{data ? data.label || "Shop location set" : "No shop location yet"}</p>
            <p className="text-sm text-slate-500">
              {data ? `Sign-in allowed within ${data.radius} m${data.updatedAt ? ` · updated ${fmtWhen(data.updatedAt)}` : ""}` : "Stand inside the shop and tap the button below."}
            </p>
            {data && (
              <a href={mapsLink(data.lat, data.lng)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                Check on Google Maps <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <Button variant="secondary" size="lg" className="w-full" loading={locating} icon={<Crosshair className="size-5" />} onClick={useHere}>
          Use my current location
        </Button>
        {accuracy !== null && accuracy > 50 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">GPS accuracy is ±{accuracy} m. Step outside or near a window and try again for a better fix.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <Input inputMode="decimal" value={form.lat} onChange={(e) => set({ lat: e.target.value })} placeholder="22.5726" />
          </Field>
          <Field label="Longitude">
            <Input inputMode="decimal" value={form.lng} onChange={(e) => set({ lng: e.target.value })} placeholder="88.3639" />
          </Field>
        </div>
        <Field label="Allowed distance (metres)" hint="How far from this point staff can sign in. 100 m suits most shops.">
          <Input type="number" inputMode="numeric" value={form.radius} onChange={(e) => set({ radius: e.target.value })} />
        </Field>
        <Field label="Name">
          <Input value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Quick Shine, Main Road" />
        </Field>
        <Button size="lg" className="w-full" loading={saving} disabled={!form.lat || !form.lng} onClick={save}>
          Save shop location
        </Button>
      </Card>
    </div>
  );
}
