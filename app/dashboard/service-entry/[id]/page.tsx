"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, IndianRupee, MessageCircle, Phone, Printer, Save, Trash2 } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { PayBadge, whatsappLink } from "@/app/components/jobs";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import {
  Button,
  Card,
  ErrorState,
  Field,
  IconButton,
  ListSkeleton,
  MoneyInput,
  Page,
  Plate,
  SectionTitle,
  Segmented,
  Select,
  Textarea,
  buttonClass,
  cn,
} from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { can } from "@/app/lib/roles";
import { JOB_STATUSES, STATUS_META, balanceOf, jobLabel, paidOf, type JobStatus, type PaymentMode } from "@/app/lib/jobs";
import { fmtDateTime, fmtWhen, inr, phoneDigits } from "@/app/lib/format";
import { serviceName, type Job, type TeamMember } from "@/app/lib/types";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: job, setData: setJob, loading, error, reload } = useApi<Job>(`/api/service-entry/${id}`);
  const team = useApi<TeamMember[]>("/api/users?lite=1");

  const [busy, setBusy] = useState<string>("");
  const [payOpen, setPayOpen] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (job) setNotes(job.notes || "");
  }, [job?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body: Record<string, unknown>, successMsg: string, key: string) => {
    setBusy(key);
    try {
      const updated = await api<Job>(`/api/service-entry/${id}`, { method: "PATCH", body });
      setJob(updated);
      toast(successMsg);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy("");
    }
  };

  const setStatus = async (status: JobStatus) => {
    if (!job || status === job.status) return;
    if (status === "delivered" && balanceOf(job) > 0) {
      const go = await confirm({
        title: "Balance still due",
        message: `${inr(balanceOf(job))} hasn't been collected yet. Mark as delivered anyway?`,
        confirmText: "Deliver anyway",
      });
      if (!go) return;
    }
    patch({ action: "status", status }, `Marked as ${STATUS_META[status].label.toLowerCase()}`, "status");
  };

  const remove = async () => {
    const ok = await confirm({ title: "Delete this job?", message: "This can't be undone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/service-entry/${id}`, { method: "DELETE" });
      toast("Job deleted");
      router.replace("/dashboard/service-entry");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) {
    return (
      <Page title="Job" back="/dashboard/service-entry">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  }
  if (loading || !job) {
    return (
      <Page title="Job" back="/dashboard/service-entry">
        <ListSkeleton rows={4} />
      </Page>
    );
  }

  const bike = job.bikeId;
  const due = balanceOf(job);
  const paid = paidOf(job);
  const meta = STATUS_META[job.status];
  const stepIndex = JOB_STATUSES.indexOf(job.status);
  const phone = phoneDigits(bike?.phone);

  return (
    <Page
      title={`Job ${jobLabel(job)}`}
      subtitle={fmtDateTime(job.createdAt)}
      back="/dashboard/service-entry"
      actions={
        <>
          <IconButton label="Print receipt" onClick={() => window.print()} className="max-sm:hidden">
            <Printer className="size-5" />
          </IconButton>
          {can.manageStudio(user.role) && (
            <IconButton label="Delete job" onClick={remove} className="text-red-500 hover:bg-red-50">
              <Trash2 className="size-5" />
            </IconButton>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {/* Bike & customer */}
          <Card className="p-4">
            <Link href={bike ? `/dashboard/bikes/${bike._id}` : "#"} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Plate number={bike?.bikeNumber || "—"} size="lg" />
                <p className="mt-2 truncate font-semibold text-slate-800">{bike?.ownerName || "Walk-in customer"}</p>
                <p className="truncate text-sm text-slate-500">{[bike?.model, bike?.phone].filter(Boolean).join(" · ")}</p>
              </div>
              <ChevronRight className="size-5 text-slate-300 print:hidden" />
            </Link>
            {phone && (
              <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
                <a href={`tel:+${phone}`} className={buttonClass("outline", "md")}>
                  <Phone className="size-4" /> Call
                </a>
                <a href={whatsappLink(job)} target="_blank" rel="noreferrer" className={buttonClass("outline", "md", "text-emerald-700")}>
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </div>
            )}
          </Card>

          {/* Workflow */}
          <Card className="p-4 print:hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Status</p>
              <span className="text-sm font-semibold text-brand-700">{meta.label}</span>
            </div>
            <ol className="mt-4 grid grid-cols-4">
              {JOB_STATUSES.map((s, i) => {
                const done = i <= stepIndex;
                return (
                  <li key={s} className="relative flex flex-col items-center">
                    {i > 0 && (
                      <span className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", i <= stepIndex ? "bg-brand-600" : "bg-slate-200")} />
                    )}
                    <button
                      type="button"
                      onClick={() => setStatus(s)}
                      disabled={!!busy}
                      aria-label={`Set status: ${STATUS_META[s].label}`}
                      className={cn(
                        "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition",
                        done ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-400",
                        i === stepIndex && "ring-4 ring-brand-100"
                      )}
                    >
                      {i < stepIndex ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    </button>
                    <span className={cn("mt-1.5 text-[11px] font-medium", done ? "text-slate-800" : "text-slate-400")}>
                      {STATUS_META[s].short}
                    </span>
                  </li>
                );
              })}
            </ol>
            {meta.next && (
              <Button size="lg" className="mt-4 w-full" loading={busy === "status"} onClick={() => setStatus(meta.next!)}>
                {meta.action}
              </Button>
            )}
            {job.status === "completed" && phone && (
              <a href={whatsappLink(job)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "mt-2 w-full")}>
                <MessageCircle className="size-4" /> Tell customer it&apos;s ready
              </a>
            )}
          </Card>

          {/* Bill */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="text-sm font-semibold text-slate-700">Bill</p>
              <PayBadge job={job} />
            </div>
            <div className="divide-y divide-slate-100 px-4">
              {job.services.map((s) => (
                <div key={s._id} className="flex justify-between py-2.5 text-sm">
                  <span className="text-slate-700">{serviceName(s)}</span>
                  <span className="font-medium tabular-nums text-slate-900">{inr(s.price)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 bg-slate-50 px-4 py-3 text-sm tabular-nums">
              {job.subtotal !== job.total && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>{inr(job.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount{job.discountType === "percent" ? ` (${job.discount}%)` : ""}</span>
                    <span>− {inr(job.subtotal - job.total)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{inr(job.total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Paid</span>
                <span>{inr(paid)}</span>
              </div>
              {due > 0 && (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Balance due</span>
                  <span>{inr(due)}</span>
                </div>
              )}
            </div>
            {due > 0 && (
              <div className="p-4 pt-3 print:hidden">
                <Button variant="success" size="lg" className="w-full" icon={<IndianRupee className="size-5" />} onClick={() => setPayOpen(true)}>
                  Collect {inr(due)}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2 print:hidden">
          {/* Payments */}
          {job.payments.length > 0 && (
            <div>
              <SectionTitle>Payments</SectionTitle>
              <Card className="divide-y divide-slate-100">
                {job.payments.map((p) => (
                  <div key={p._id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium capitalize text-slate-800">{p.mode === "online" ? "UPI / Online" : "Cash"}</p>
                      <p className="text-xs text-slate-500">
                        {fmtWhen(p.at)}
                        {p.by?.name ? ` · ${p.by.name}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-600">+ {inr(p.amount)}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Details */}
          <div>
            <SectionTitle>Details</SectionTitle>
            <Card className="space-y-4 p-4">
              <Field label="Assigned to">
                <Select
                  value={job.assignedTo?._id || ""}
                  disabled={busy === "assign"}
                  onChange={(e) => patch({ action: "update", assignedTo: e.target.value }, "Job reassigned", "assign")}
                >
                  <option value="">Unassigned</option>
                  {(team.data || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note about this job" />
              </Field>
              {notes !== (job.notes || "") && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === "notes"}
                  icon={<Save className="size-4" />}
                  onClick={() => patch({ action: "update", notes }, "Notes saved", "notes")}
                >
                  Save notes
                </Button>
              )}
              <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                <Meta label="Created by" value={job.createdBy?.name || "—"} />
                {job.completedAt && <Meta label="Ready at" value={fmtWhen(job.completedAt)} />}
                {job.deliveredAt && <Meta label="Delivered at" value={fmtWhen(job.deliveredAt)} />}
              </dl>
            </Card>
          </div>
        </div>
      </div>

      <CollectSheet
        key={due}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        balance={due}
        onSubmit={async (amount, mode) => {
          const ok = await patch({ action: "pay", amount, mode }, `${inr(amount)} received`, "pay");
          if (ok) setPayOpen(false);
        }}
        loading={busy === "pay"}
      />
    </Page>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function CollectSheet({
  open,
  onClose,
  balance,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  onSubmit: (amount: number, mode: PaymentMode) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState<PaymentMode>("cash");

  const close = () => {
    setAmount(String(balance));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Collect payment"
      footer={
        <Button size="lg" variant="success" className="w-full" loading={loading} onClick={() => onSubmit(Number(amount), mode)}>
          Receive {inr(Number(amount) || 0)}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" hint={`Balance due: ${inr(balance)}`}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-bold" autoFocus />
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
      </div>
    </Sheet>
  );
}
