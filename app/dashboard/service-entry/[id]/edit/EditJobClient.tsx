"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Save, X } from "lucide-react";
import { useToast } from "@/app/components/overlays";
import { OnlinePayeeNote } from "@/app/components/OnlinePayeeNote";
import { Button, Card, ErrorState, Field, Input, ListSkeleton, MoneyInput, Page, Plate, SectionTitle, Segmented, Select, Textarea, cn } from "@/app/components/ui";
import { api, primeApiCache, useApi } from "@/app/lib/api";
import { JOB_STATUSES, STATUS_META, calcTotals, jobLabel, type DiscountType, type JobStatus, type PaymentMode } from "@/app/lib/jobs";
import { inr, toDateTimeInput } from "@/app/lib/format";
import { serviceName, type Job, type Service, type TeamMember } from "@/app/lib/types";

type Line = { key: string; serviceId: string; name: string; price: string };
type PayRow = { key: string; amount: string; mode: PaymentMode; at: string; by: string; byName?: string };

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;
const iso = (local: string) => (local ? new Date(local).toISOString() : null);

export default function EditJobClient() {
  const { id } = useParams<{ id: string }>();
  const job = useApi<Job>(`/api/service-entry/${id}`);
  const catalog = useApi<Service[]>("/api/services?all=1");
  const team = useApi<TeamMember[]>("/api/users?lite=1");

  if (job.error) {
    return (
      <Page title="Edit job" back={`/dashboard/service-entry/${id}`}>
        <ErrorState message={job.error} onRetry={job.reload} />
      </Page>
    );
  }
  if (!job.data) {
    return (
      <Page title="Edit job" back={`/dashboard/service-entry/${id}`}>
        <ListSkeleton rows={5} />
      </Page>
    );
  }
  return <EditForm job={job.data} catalog={catalog.data || []} team={team.data || []} />;
}

function EditForm({ job, catalog, team }: { job: Job; catalog: Service[]; team: TeamMember[] }) {
  const router = useRouter();
  const toast = useToast();

  const [date, setDate] = useState(() => toDateTimeInput(job.createdAt));
  const [lines, setLines] = useState<Line[]>(() =>
    job.services.map((s) => ({
      key: nextKey(),
      serviceId: typeof s.serviceId === "object" && s.serviceId ? s.serviceId._id : String(s.serviceId),
      name: serviceName(s),
      price: String(s.price),
    }))
  );
  const [discountType, setDiscountType] = useState<DiscountType>(job.discountType || "flat");
  const [discount, setDiscount] = useState(job.discount ? String(job.discount) : "");
  const [status, setStatusState] = useState<JobStatus>(job.status);
  const [completedAt, setCompletedAt] = useState(job.completedAt ? toDateTimeInput(job.completedAt) : "");
  const [deliveredAt, setDeliveredAt] = useState(job.deliveredAt ? toDateTimeInput(job.deliveredAt) : "");
  const [assignedTo, setAssignedTo] = useState(job.assignedTo?._id || "");
  const [notes, setNotes] = useState(job.notes || "");
  const [payments, setPayments] = useState<PayRow[]>(() => {
    if (job.payments.length) {
      return job.payments.map((p) => ({
        key: nextKey(),
        amount: String(p.amount),
        mode: p.mode,
        at: toDateTimeInput(p.at),
        by: p.by?._id || "",
        byName: p.by?.name,
      }));
    }
    // entries from before payment tracking: show what was paid as one editable payment
    const paid = job.paidAmount ?? (job.paymentType === "due" ? 0 : job.total);
    return paid > 0
      ? [
          {
            key: nextKey(),
            amount: String(paid),
            mode: job.paymentType === "online" ? "online" : "cash",
            at: toDateTimeInput(job.createdAt),
            by: job.createdBy?._id || "",
            byName: job.createdBy?.name,
          },
        ]
      : [];
  });
  const [addService, setAddService] = useState("");
  const [saving, setSaving] = useState(false);

  // Keep ready/delivered times sensible when the status changes
  const setStatus = (s: JobStatus) => {
    const now = toDateTimeInput(new Date());
    if ((s === "completed" || s === "delivered") && !completedAt) setCompletedAt(deliveredAt || now);
    if (s === "delivered" && !deliveredAt) setDeliveredAt(now);
    setStatusState(s);
  };

  const totals = calcTotals(lines.map((l) => Number(l.price) || 0), Number(discount) || 0, discountType);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const overpaid = paid > totals.total + 0.001;

  // People who can be picked as collector: active team + anyone already on a payment
  const people = useMemo(() => {
    const map = new Map(team.map((m) => [m._id, m.name]));
    for (const p of payments) if (p.by && !map.has(p.by)) map.set(p.by, p.byName || "Former member");
    return [...map.entries()];
  }, [team, payments]);

  // Moving the check-in date also moves whatever happened at check-in (the payment taken
  // then, ready/delivered for instant jobs) — otherwise those stay on the old day.
  const changeDate = (next: string) => {
    const delta = new Date(next).getTime() - new Date(date).getTime();
    if (!delta) return;
    const move = (v: string) => (v === date ? toDateTimeInput(new Date(new Date(v).getTime() + delta)) : v);
    setPayments((list) => list.map((p) => ({ ...p, at: move(p.at) })));
    setCompletedAt(move);
    setDeliveredAt(move);
    setDate(next);
  };

  const setPay = (key: string, patch: Partial<PayRow>) => setPayments((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!lines.length) return toast("Keep at least one service", "error");
    if (overpaid) return toast("Payments add up to more than the bill", "error");
    setSaving(true);
    try {
      const saved = await api<Job>(`/api/service-entry/${job._id}`, {
        method: "PATCH",
        body: {
          action: "edit",
          date: iso(date),
          services: lines.map((l) => ({ serviceId: l.serviceId, price: Number(l.price) || 0 })),
          discount: Number(discount) || 0,
          discountType,
          status,
          completedAt: status === "completed" || status === "delivered" ? iso(completedAt) : null,
          deliveredAt: status === "delivered" ? iso(deliveredAt) : null,
          assignedTo,
          notes,
          payments: payments.map((p) => ({ amount: Number(p.amount) || 0, mode: p.mode, at: iso(p.at), by: p.by || undefined })),
        },
      });
      toast("Job updated");
      // the job page shows the saved version immediately instead of the old cached one
      primeApiCache(`/api/service-entry/${job._id}`, saved);
      // go back to the job (keeps history clean, so its back arrow returns to the filtered list)
      if (window.history.length > 1) router.back();
      else router.replace(`/dashboard/service-entry/${job._id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  };

  const max = toDateTimeInput(new Date());

  return (
    <Page
      title={`Edit job ${jobLabel(job)}`}
      subtitle="Super Admin correction"
      back={`/dashboard/service-entry/${job._id}`}
      className="pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-32"
    >
      <Card className="flex items-center gap-3 p-4">
        <Plate number={job.bikeId?.bikeNumber || "—"} />
        <span className="truncate text-sm text-slate-600">{[job.bikeId?.model, job.bikeId?.ownerName].filter(Boolean).join(" · ")}</span>
      </Card>

      <SectionTitle>Date & time</SectionTitle>
      <Card className="p-4">
        <Field label="Job checked in at" hint="Moves this job (and its reports) to the corrected day">
          <Input type="datetime-local" value={date} max={max} onChange={(e) => e.target.value && changeDate(e.target.value)} />
        </Field>
      </Card>

      <SectionTitle>Services & bill</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{l.name}</span>
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={l.price}
                aria-label={`Price for ${l.name}`}
                onChange={(e) => setLines((all) => all.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border border-slate-200 pl-6 pr-2 text-right text-base font-semibold tabular-nums outline-none focus:border-brand-500"
              />
            </div>
            <button
              type="button"
              aria-label={`Remove ${l.name}`}
              onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 px-4 py-3">
          <Select value={addService} onChange={(e) => setAddService(e.target.value)} aria-label="Add a service" className="min-w-0 flex-1">
            <option value="">Add a service…</option>
            {catalog.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} — {inr(s.price)}
                {s.isActive ? "" : " (hidden)"}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!addService}
            icon={<Plus className="size-4" />}
            onClick={() => {
              const s = catalog.find((x) => x._id === addService);
              if (s) setLines((all) => [...all, { key: nextKey(), serviceId: s._id, name: s.name, price: String(s.price) }]);
              setAddService("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex-1 text-sm font-medium text-slate-700">Discount</span>
          <Segmented
            size="sm"
            className="w-24"
            value={discountType}
            onChange={setDiscountType}
            options={[
              { value: "flat", label: "₹" },
              { value: "percent", label: "%" },
            ]}
          />
          <input
            type="number"
            inputMode="decimal"
            value={discount}
            placeholder="0"
            aria-label="Discount"
            onChange={(e) => setDiscount(e.target.value)}
            className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right text-base font-semibold tabular-nums outline-none focus:border-brand-500"
          />
        </div>
        <div className="space-y-1 bg-slate-50 px-4 py-3 text-sm tabular-nums">
          <Row label="Subtotal" value={inr(totals.subtotal)} />
          {totals.discountAmount > 0 && <Row label="Discount" value={`− ${inr(totals.discountAmount)}`} className="text-emerald-600" />}
          <Row label="Total" value={inr(totals.total)} className="font-bold text-slate-900" />
        </div>
      </Card>

      <SectionTitle>Payments</SectionTitle>
      <div className="space-y-3">
        {payments.map((p, i) => (
          <Card key={p.key} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Payment {i + 1}</p>
              <button type="button" onClick={() => setPayments((list) => list.filter((x) => x.key !== p.key))} className="text-sm font-semibold text-red-600">
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput value={p.amount} onChange={(e) => setPay(p.key, { amount: e.target.value })} aria-label="Amount" />
              <Segmented
                value={p.mode}
                onChange={(mode) => setPay(p.key, { mode })}
                className="h-12"
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "online", label: "Online" },
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Received on">
                <Input type="datetime-local" value={p.at} max={max} onChange={(e) => e.target.value && setPay(p.key, { at: e.target.value })} />
              </Field>
              {p.mode === "online" ? (
                <div className="flex items-end">
                  <OnlinePayeeNote />
                </div>
              ) : (
                <Field label="Cash collected by">
                  <Select value={p.by} onChange={(e) => setPay(p.key, { by: e.target.value })}>
                    <option value="">Me</option>
                    {people.map(([pid, name]) => (
                      <option key={pid} value={pid}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          </Card>
        ))}
        <Button
          variant="secondary"
          icon={<Plus className="size-4" />}
          onClick={() =>
            setPayments((list) => [
              ...list,
              { key: nextKey(), amount: String(Math.max(0, totals.total - paid)), mode: "cash", at: toDateTimeInput(new Date()), by: "" },
            ])
          }
        >
          Add payment
        </Button>
        <div className={cn("flex justify-between rounded-2xl px-4 py-3 text-sm font-semibold", overpaid ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700")}>
          <span className="flex items-center gap-1.5">
            {overpaid && <AlertTriangle className="size-4" />} Paid {inr(paid)}
          </span>
          <span>{overpaid ? `${inr(paid - totals.total)} more than the bill` : `Balance ${inr(Math.max(0, totals.total - paid))}`}</span>
        </div>
      </div>

      <SectionTitle>Status & team</SectionTitle>
      <Card className="space-y-4 p-4">
        <Segmented size="sm" value={status} onChange={setStatus} options={JOB_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].short }))} />
        {(status === "completed" || status === "delivered") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ready at">
              <Input type="datetime-local" value={completedAt} max={max} onChange={(e) => setCompletedAt(e.target.value)} />
            </Field>
            {status === "delivered" && (
              <Field label="Delivered at">
                <Input type="datetime-local" value={deliveredAt} max={max} onChange={(e) => setDeliveredAt(e.target.value)} />
              </Field>
            )}
          </div>
        )}
        <Field label="Assigned to">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">New total</p>
            <p className="text-xl font-bold tabular-nums text-slate-900">{inr(totals.total)}</p>
          </div>
          <Button size="lg" onClick={save} loading={saving} disabled={overpaid} icon={!saving && <Save className="size-5" />} className="min-w-40">
            Save changes
          </Button>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between text-slate-600", className)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
