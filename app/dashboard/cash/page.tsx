"use client";

import { useState } from "react";
import { ArrowRightLeft, Banknote, Check, Clock, HandCoins, Smartphone, Undo2, Users, Wallet, X } from "lucide-react";
import { usePendingHandovers, useSession } from "@/app/components/AppShell";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import { PERIOD_LABEL, PeriodPicker, usePeriod } from "@/app/components/PeriodPicker";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, MoneyInput, Page, SectionTitle, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { fmtWhen, inr, rangeQuery } from "@/app/lib/format";
import { ROLE_LABEL, can } from "@/app/lib/roles";
import type { CashPosition, Handover } from "@/app/lib/types";

type CashData = {
  me: CashPosition | null;
  team: CashPosition[];
  period: { userId: string; name: string; cash: number; online: number; count: number }[];
  requests: Handover[];
};

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red", cancelled: "gray" } as const;

export default function CashPage() {
  const user = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const handoverCtx = usePendingHandovers();
  const approver = can.approveCash(user.role);

  const period = usePeriod("today");
  const { data, loading, error, reload } = useApi<CashData>(`/api/cash?${rangeQuery(period.range)}`);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState("");

  const refresh = () => {
    reload();
    handoverCtx.reload();
  };

  const decide = async (h: Handover, action: "approve" | "reject" | "cancel") => {
    if (action === "approve") {
      const ok = await confirm({
        title: `Received ${inr(h.amount)}?`,
        message: `Confirm that ${h.from?.name || "they"} handed this cash to you. It moves to your cash in hand.`,
        confirmText: "Yes, received",
      });
      if (!ok) return;
    }
    if (action === "reject") {
      const ok = await confirm({ title: "Reject this handover?", message: "The cash stays with the sender.", confirmText: "Reject", danger: true });
      if (!ok) return;
    }
    setBusy(h._id + action);
    try {
      await api(`/api/cash/handover/${h._id}`, { method: "PATCH", body: { action } });
      toast(action === "approve" ? `${inr(h.amount)} received` : action === "reject" ? "Handover rejected" : "Request cancelled");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };

  const me = data?.me;
  const toApprove = (data?.requests || []).filter((r) => r.status === "pending" && r.from?._id !== user.id);
  const mine = (data?.requests || []).filter((r) => r.from?._id === user.id);
  const others = (data?.requests || []).filter((r) => r.from?._id !== user.id && r.status !== "pending");
  const teamHolding = (data?.team || []).filter((p) => Math.abs(p.inHand) > 0.001);
  const teamTotal = teamHolding.reduce((s, p) => s + p.inHand, 0);

  return (
    <Page title="Cash & handover" subtitle="Who is holding the studio's cash" back="/dashboard/more">
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-70")}>
          {/* ── My cash ── */}
          <div className="rounded-3xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-lg shadow-emerald-900/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/70">Cash in my hand</p>
                <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{inr(me?.inHand || 0)}</p>
                {!!me?.pending && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-amber-200">
                    <Clock className="size-4" /> {inr(me.pending)} waiting for approval
                  </p>
                )}
              </div>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
                <Wallet className="size-6" />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Mini label="Collected" value={me?.collected || 0} />
              <Mini label={approver ? "Received" : "Handed over"} value={approver ? me?.received || 0 : me?.handedOver || 0} />
              <Mini label={approver ? "Spent (expenses)" : "Available"} value={approver ? me?.spent || 0 : me?.available || 0} />
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="mt-4 w-full bg-white text-emerald-800 hover:bg-emerald-50"
              disabled={!me || me.available <= 0}
              icon={<HandCoins className="size-5" />}
              onClick={() => setSheetOpen(true)}
            >
              {approver ? "Hand over to another admin" : "Hand over cash"}
            </Button>
            {!approver && me && me.available > 0 && (
              <p className="mt-2 text-center text-xs text-white/70">Hand over your cash to the Super Admin / Admin at the end of the day.</p>
            )}
          </div>

          {/* ── Approvals ── */}
          {approver && (
            <>
              <SectionTitle>Waiting for your approval</SectionTitle>
              {toApprove.length === 0 ? (
                <Card className="p-4 text-sm text-slate-500">No handover requests right now.</Card>
              ) : (
                <div className="space-y-3">
                  {toApprove.map((h) => (
                    <Card key={h._id} className="border-amber-200 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={h.from?.name || "?"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{h.from?.name}</p>
                          <p className="text-xs text-slate-500">
                            {h.from?.role ? `${ROLE_LABEL[h.from.role]} · ` : ""}
                            {fmtWhen(h.createdAt)}
                          </p>
                        </div>
                        <p className="text-xl font-bold tabular-nums text-slate-900">{inr(h.amount)}</p>
                      </div>
                      {h.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{h.note}”</p>}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button variant="outline" icon={<X className="size-4" />} loading={busy === h._id + "reject"} onClick={() => decide(h, "reject")}>
                          Reject
                        </Button>
                        <Button variant="success" icon={<Check className="size-4" />} loading={busy === h._id + "approve"} onClick={() => decide(h, "approve")}>
                          Received
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── Team holdings ── */}
              <SectionTitle action={<span className="text-xs font-semibold tabular-nums text-slate-500">Total {inr(teamTotal)}</span>}>
                Who is holding cash
              </SectionTitle>
              {teamHolding.length === 0 ? (
                <Card className="p-4 text-sm text-slate-500">Nobody is holding cash.</Card>
              ) : (
                <Card className="divide-y divide-slate-100">
                  {teamHolding.map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={p.name} className="size-9 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {p.name}
                          {p.userId === user.id && <span className="font-normal text-slate-400"> (me)</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ROLE_LABEL[p.role as keyof typeof ROLE_LABEL] || p.role}
                          {p.pending > 0 ? ` · ${inr(p.pending)} pending handover` : ""}
                        </p>
                      </div>
                      <span className={cn("font-bold tabular-nums", p.inHand < 0 ? "text-red-600" : "text-slate-900")}>{inr(p.inHand)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          {/* ── Collections in period ── */}
          <SectionTitle>{approver ? "Collections by person" : "My collections"}</SectionTitle>
          <PeriodPicker period={period} />
          {data.period.length === 0 ? (
            <Card className="mt-3 p-4 text-sm text-slate-500">No payments collected {PERIOD_LABEL[period.preset]}.</Card>
          ) : (
            <Card className="mt-3 divide-y divide-slate-100">
              {data.period.map((r) => (
                <div key={r.userId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.count} payment(s)</p>
                  </div>
                  <div className="flex gap-4 text-right text-sm tabular-nums">
                    <span>
                      <span className="flex items-center justify-end gap-1 text-[11px] text-slate-500">
                        <Banknote className="size-3" /> Cash
                      </span>
                      <b className="text-slate-900">{inr(r.cash)}</b>
                    </span>
                    <span>
                      <span className="flex items-center justify-end gap-1 text-[11px] text-slate-500">
                        <Smartphone className="size-3" /> Online
                      </span>
                      <b className="text-slate-900">{inr(r.online)}</b>
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ── Requests ── */}
          <SectionTitle>{approver ? "My handovers" : "My handover requests"}</SectionTitle>
          <RequestList requests={mine} meId={user.id} busy={busy} onCancel={(h) => decide(h, "cancel")} emptyText="You haven't handed over any cash in this period." />

          {approver && (
            <>
              <SectionTitle>Team handovers · {PERIOD_LABEL[period.preset]}</SectionTitle>
              <RequestList requests={others} meId={user.id} busy={busy} emptyText="No handovers decided in this period." />
            </>
          )}
        </div>
      )}

      <HandoverSheet
        open={sheetOpen}
        available={me?.available || 0}
        onClose={() => setSheetOpen(false)}
        onSent={() => {
          setSheetOpen(false);
          refresh();
        }}
      />
    </Page>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <p className="text-white/60">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{inr(value)}</p>
    </div>
  );
}

function RequestList({
  requests,
  meId,
  busy,
  onCancel,
  emptyText,
}: {
  requests: Handover[];
  meId: string;
  busy: string;
  onCancel?: (h: Handover) => void;
  emptyText: string;
}) {
  if (!requests.length) {
    return (
      <Card>
        <EmptyState icon={<ArrowRightLeft />} title="Nothing here" text={emptyText} />
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-slate-100">
      {requests.map((h) => (
        <div key={h._id} className="flex items-center gap-3 px-4 py-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", h.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
            {h.status === "pending" ? <Clock className="size-4" /> : <Users className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {h.from?._id === meId ? "Me" : h.from?.name} → {h.to?.name || "Super Admin / Admin"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {fmtWhen(h.createdAt)}
              {h.note ? ` · ${h.note}` : ""}
              {h.reason ? ` · ${h.reason}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-bold tabular-nums text-slate-900">{inr(h.amount)}</span>
            <Badge tone={STATUS_TONE[h.status]}>{h.status === "approved" ? "Received" : h.status[0].toUpperCase() + h.status.slice(1)}</Badge>
          </div>
          {onCancel && h.status === "pending" && h.from?._id === meId && (
            <button
              type="button"
              aria-label="Cancel request"
              title="Cancel request"
              disabled={busy === h._id + "cancel"}
              onClick={() => onCancel(h)}
              className="flex size-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <Undo2 className="size-4" />
            </button>
          )}
        </div>
      ))}
    </Card>
  );
}

function HandoverSheet({ open, available, onClose, onSent }: { open: boolean; available: number; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const value = amount === "" ? available : Number(amount) || 0;

  const send = async () => {
    setSaving(true);
    try {
      await api("/api/cash/handover", { method: "POST", body: { amount: value, note } });
      toast("Handover request sent for approval");
      setAmount("");
      setNote("");
      onSent();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Hand over cash"
      footer={
        <Button size="lg" variant="success" className="w-full" loading={saving} disabled={value <= 0 || value > available + 0.001} onClick={send}>
          Send {inr(value)} for approval
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Give the cash to the Super Admin / Admin. Once they tap <b>Received</b>, it moves to their cash in hand.
        </p>
        <Field label="Amount" hint={`You can hand over up to ${inr(available)}`}>
          <MoneyInput value={amount} placeholder={String(available)} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-bold" />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. End of day 6 Oct" />
        </Field>
      </div>
    </Sheet>
  );
}
