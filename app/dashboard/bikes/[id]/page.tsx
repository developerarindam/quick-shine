"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bike as BikeIcon,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  IndianRupee,
  MessageCircle,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { accentFor, customerTier } from "@/app/components/bikes";
import BikeFormSheet from "@/app/components/BikeFormSheet";
import { PayBadge, StatusBadge } from "@/app/components/jobs";
import { useConfirm, useToast } from "@/app/components/overlays";
import { Avatar, Card, EmptyState, ErrorState, IconButton, ListSkeleton, Page, SectionTitle, Segmented, buttonClass, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { can } from "@/app/lib/roles";
import { ACTIVE_STATUSES, balanceOf, jobLabel, paidOf } from "@/app/lib/jobs";
import { fmtAgo, fmtDate, fmtTime, inr, phoneDigits } from "@/app/lib/format";
import { serviceName, type Bike, type Job } from "@/app/lib/types";

type View = "timeline" | "jobs" | "payments";

type TimelineEvent = {
  key: string;
  at: Date;
  icon: typeof Plus;
  tint: string;
  title: string;
  detail?: string;
  by?: string;
  href?: string;
  amount?: { value: number; positive?: boolean };
};

type PaymentRow = { key: string; at: Date; amount: number; mode: string; by?: string; job: Job; atBilling?: boolean };

export default function BikeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi<{ bike: Bike; jobs: Job[] }>(`/api/bikes/${id}`);
  const [editOpen, setEditOpen] = useState(false);
  const [view, setView] = useState<View>("timeline");

  const derived = useMemo(() => {
    if (!data) return null;
    const { bike, jobs } = data;

    const spent = jobs.reduce((s, j) => s + j.total, 0);
    const paid = jobs.reduce((s, j) => s + paidOf(j), 0);
    const due = jobs.reduce((s, j) => s + balanceOf(j), 0);
    const first = jobs.length ? new Date(jobs[jobs.length - 1].createdAt) : new Date(bike.createdAt);
    const inStudio = jobs.some((j) => ACTIVE_STATUSES.includes(j.status));

    // Average days between visits
    let gapDays: number | null = null;
    if (jobs.length > 1) {
      const span = new Date(jobs[0].createdAt).getTime() - new Date(jobs[jobs.length - 1].createdAt).getTime();
      gapDays = Math.round(span / 86400000 / (jobs.length - 1));
    }

    // Favourite services
    const svc = new Map<string, number>();
    for (const j of jobs) for (const s of j.services) svc.set(serviceName(s), (svc.get(serviceName(s)) || 0) + 1);
    const favourites = [...svc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Payments, incl. old entries that were paid at billing without a payment record
    const payments: PaymentRow[] = [];
    for (const j of jobs) {
      if (j.payments.length) {
        for (const p of j.payments) payments.push({ key: p._id, at: new Date(p.at), amount: p.amount, mode: p.mode, by: p.by?.name, job: j });
      } else if (paidOf(j) > 0) {
        payments.push({ key: `${j._id}-bill`, at: new Date(j.createdAt), amount: paidOf(j), mode: j.paymentType === "online" ? "online" : "cash", job: j, atBilling: true });
      }
    }
    payments.sort((a, b) => b.at.getTime() - a.at.getTime());

    // Timeline of everything that happened to this bike
    const events: TimelineEvent[] = [
      {
        key: "registered",
        at: new Date(bike.createdAt),
        icon: UserPlus,
        tint: "bg-slate-100 text-slate-600",
        title: "Registered at Quick Shine",
        detail: [bike.ownerName, bike.model].filter(Boolean).join(" · ") || undefined,
      },
    ];
    for (const j of jobs) {
      const href = `/dashboard/service-entry/${j._id}`;
      events.push({
        key: `${j._id}-created`,
        at: new Date(j.createdAt),
        icon: ClipboardList,
        tint: "bg-brand-100 text-brand-700",
        title: `Job ${jobLabel(j)} checked in`,
        detail: j.services.map(serviceName).join(", ") + (j.notes ? ` — “${j.notes}”` : ""),
        by: j.createdBy?.name,
        href,
        amount: { value: j.total },
      });
      if (j.completedAt) {
        events.push({ key: `${j._id}-ready`, at: new Date(j.completedAt), icon: PackageCheck, tint: "bg-violet-100 text-violet-700", title: `Job ${jobLabel(j)} ready for pickup`, by: j.assignedTo?.name, href });
      }
      if (j.deliveredAt) {
        events.push({ key: `${j._id}-delivered`, at: new Date(j.deliveredAt), icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-700", title: `Job ${jobLabel(j)} delivered`, href });
      }
    }
    for (const p of payments) {
      events.push({
        key: `pay-${p.key}`,
        // an advance taken at check-in is stamped a moment before the job itself; keep it after
        at: new Date(Math.max(p.at.getTime(), new Date(p.job.createdAt).getTime() + 1)),
        icon: IndianRupee,
        tint: "bg-emerald-100 text-emerald-700",
        title: `Payment received · ${p.mode === "online" ? "UPI / Online" : "Cash"}`,
        detail: `For job ${jobLabel(p.job)}${p.atBilling ? " (paid at billing)" : ""}`,
        by: p.by,
        href: `/dashboard/service-entry/${p.job._id}`,
        amount: { value: p.amount, positive: true },
      });
    }
    // newest first
    events.sort((a, b) => b.at.getTime() - a.at.getTime());

    const grouped: [string, TimelineEvent[]][] = [];
    for (const e of events) {
      const day = fmtDate(e.at);
      const last = grouped[grouped.length - 1];
      if (last && last[0] === day) last[1].push(e);
      else grouped.push([day, [e]]);
    }

    return { spent, paid, due, first, inStudio, gapDays, favourites, payments, grouped };
  }, [data]);

  if (error) {
    return (
      <Page title="Bike" back="/dashboard/bikes">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  }
  if ((loading && !data) || !data || !derived) {
    return (
      <Page title="Bike" back="/dashboard/bikes">
        <ListSkeleton rows={4} />
      </Page>
    );
  }

  const { bike, jobs } = data;
  const tier = customerTier(jobs.length);
  const phone = phoneDigits(bike.phone);

  const remove = async () => {
    const ok = await confirm({ title: `Delete ${bike.bikeNumber}?`, message: "This removes the bike and customer details.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/bikes/${id}`, { method: "DELETE" });
      toast("Bike deleted");
      router.replace("/dashboard/bikes");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Page
      title={bike.bikeNumber}
      subtitle={bike.model}
      back="/dashboard/bikes"
      actions={
        <>
          <IconButton label="Edit bike" onClick={() => setEditOpen(true)}>
            <Pencil className="size-5" />
          </IconButton>
          {can.manageStudio(user.role) && (
            <IconButton label="Delete bike" onClick={remove} className="text-red-500 hover:bg-red-50">
              <Trash2 className="size-5" />
            </IconButton>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Profile ── */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden rounded-3xl">
            <div className={cn("relative bg-linear-to-br px-5 pb-6 pt-5 text-white", accentFor(bike.bikeNumber))}>
              <BikeIcon className="pointer-events-none absolute -bottom-6 -right-4 size-36 text-white/10" strokeWidth={1.5} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", tier.cls)}>
                  <tier.icon className="size-3" /> {tier.label} customer
                </span>
                {derived.inStudio && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-emerald-950">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-950" /> In studio
                  </span>
                )}
              </div>
              <div className="mt-4 inline-flex rounded-lg border-[3px] border-slate-900 bg-white px-3 py-1 font-mono text-2xl font-extrabold tracking-widest text-slate-900 shadow-lg shadow-black/20">
                {bike.bikeNumber}
              </div>
              <p className="mt-2 font-medium text-white/90">{bike.model || "Model not added"}</p>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={bike.ownerName || bike.bikeNumber} className="size-12" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{bike.ownerName || "Unknown owner"}</p>
                  <p className="truncate text-sm text-slate-500">{bike.phone || "No phone number"}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Link href={`/dashboard/service-entry/add?bike=${bike._id}`} className={buttonClass("primary", "md", phone ? "" : "col-span-3")}>
                  <Plus className="size-4" /> Job
                </Link>
                {phone && (
                  <>
                    <a href={`tel:+${phone}`} className={buttonClass("outline")}>
                      <Phone className="size-4" /> Call
                    </a>
                    <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className={buttonClass("outline", "md", "text-emerald-700")}>
                      <MessageCircle className="size-4" /> Chat
                    </a>
                  </>
                )}
              </div>
              {bike.notes && (
                <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <StickyNote className="mt-0.5 size-4 shrink-0" /> {bike.notes}
                </p>
              )}
            </div>
          </Card>

          <Card className="grid grid-cols-3 gap-y-4 p-4 text-center">
            <Metric label="Visits" value={String(jobs.length)} />
            <Metric label="Total spent" value={inr(derived.spent)} />
            <Metric label="Paid" value={inr(derived.paid)} />
            <Metric label="Due" value={inr(derived.due)} danger={derived.due > 0} />
            <Metric label="Avg / visit" value={jobs.length ? inr(Math.round(derived.spent / jobs.length)) : "—"} />
            <Metric label={jobs.length ? "Customer since" : "Registered"} value={derived.first.toLocaleDateString("en-IN", { month: "short", year: "numeric" })} />
          </Card>
          {derived.gapDays !== null && (
            <p className="px-1 text-xs text-slate-500">
              Visits about every <b>{derived.gapDays} days</b> · last visit {fmtAgo(jobs[0].createdAt)}
            </p>
          )}

          {derived.favourites.length > 0 && (
            <div>
              <SectionTitle>Favourite services</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {derived.favourites.map(([name, count]) => (
                  <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                    {name}
                    <span className="rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-700">{count}×</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── History ── */}
        <div className="lg:col-span-3">
          <SectionTitle>Complete history</SectionTitle>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "timeline", label: "Timeline" },
              { value: "jobs", label: `Jobs (${jobs.length})` },
              { value: "payments", label: `Payments (${derived.payments.length})` },
            ]}
          />

          <div className="mt-4">
            {view === "timeline" && <Timeline groups={derived.grouped} />}
            {view === "jobs" &&
              (jobs.length === 0 ? (
                <Card>
                  <EmptyState icon={<ClipboardList />} title="No jobs yet" text="This bike hasn't been serviced yet." />
                </Card>
              ) : (
                <div className="space-y-3">
                  {jobs.map((j, i) => (
                    <JobHistoryCard key={j._id} job={j} visitNo={jobs.length - i} defaultOpen={i === 0} />
                  ))}
                </div>
              ))}
            {view === "payments" &&
              (derived.payments.length === 0 ? (
                <Card>
                  <EmptyState icon={<IndianRupee />} title="No payments yet" />
                </Card>
              ) : (
                <Card className="divide-y divide-slate-100">
                  {derived.payments.map((p) => (
                    <Link key={p.key} href={`/dashboard/service-entry/${p.job._id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <IndianRupee className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {p.mode === "online" ? "UPI / Online" : "Cash"} · Job {jobLabel(p.job)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {fmtDate(p.at)}, {fmtTime(p.at)}
                          {p.by ? ` · ${p.by}` : ""}
                          {p.atBilling ? " · paid at billing" : ""}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-emerald-600">+ {inr(p.amount)}</span>
                    </Link>
                  ))}
                  <div className="flex justify-between bg-slate-50 px-4 py-3 text-sm font-semibold">
                    <span className="text-slate-600">Total received</span>
                    <span className="tabular-nums text-slate-900">{inr(derived.paid)}</span>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      </div>

      <BikeFormSheet open={editOpen} bike={bike} onClose={() => setEditOpen(false)} onSaved={() => reload()} />
    </Page>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0 px-1">
      <p className={cn("truncate font-bold tabular-nums", danger ? "text-red-600" : "text-slate-900")}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Timeline({ groups }: { groups: [string, TimelineEvent[]][] }) {
  return (
    <div className="space-y-5">
      {groups.map(([day, events]) => (
        <div key={day}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{day}</p>
          <Card className="px-4 py-2">
            <ol className="relative">
              {events.map((e, i) => {
                const body = (
                  <div className="flex gap-3 py-3">
                    <div className="relative flex flex-col items-center">
                      <span className={cn("relative z-10 flex size-8 items-center justify-center rounded-full ring-4 ring-white", e.tint)}>
                        <e.icon className="size-4" />
                      </span>
                      {i < events.length - 1 && <span className="absolute top-8 h-[calc(100%+0.25rem)] w-px bg-slate-200" />}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{e.title}</p>
                        {e.amount && (
                          <span className={cn("shrink-0 text-sm font-bold tabular-nums", e.amount.positive ? "text-emerald-600" : "text-slate-900")}>
                            {e.amount.positive ? "+ " : ""}
                            {inr(e.amount.value)}
                          </span>
                        )}
                      </div>
                      {e.detail && <p className="mt-0.5 text-sm text-slate-600">{e.detail}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">
                        {fmtTime(e.at)}
                        {e.by ? ` · ${e.by}` : ""}
                      </p>
                    </div>
                  </div>
                );
                return <li key={e.key}>{e.href ? <Link href={e.href} className="block rounded-xl active:bg-slate-50">{body}</Link> : body}</li>;
              })}
            </ol>
          </Card>
        </div>
      ))}
    </div>
  );
}

function JobHistoryCard({ job, visitNo, defaultOpen }: { job: Job; visitNo: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const due = balanceOf(job);

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left active:bg-slate-50">
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <span className="text-[9px] font-semibold uppercase leading-none">Visit</span>
          <span className="text-sm font-bold leading-tight">{visitNo}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-900">Job {jobLabel(job)}</span>
            <StatusBadge status={job.status} />
            {due > 0 && <PayBadge job={job} />}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmtDate(job.createdAt)} · {fmtAgo(job.createdAt)}
          </p>
          {!open && <p className="mt-1 truncate text-sm text-slate-600">{job.services.map(serviceName).join(", ")}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-bold tabular-nums text-slate-900">{inr(job.total)}</span>
          <ChevronDown className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="divide-y divide-slate-100 px-4">
            {job.services.map((s) => (
              <div key={s._id} className="flex justify-between py-2 text-sm">
                <span className="text-slate-700">{serviceName(s)}</span>
                <span className="tabular-nums text-slate-900">{inr(s.price)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 bg-slate-50 px-4 py-3 text-sm tabular-nums">
            {job.subtotal !== job.total && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>− {inr(job.subtotal - job.total)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span>{inr(job.total)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Paid</span>
              <span>{inr(paidOf(job))}</span>
            </div>
            {due > 0 && (
              <div className="flex justify-between font-semibold text-red-600">
                <span>Balance due</span>
                <span>{inr(due)}</span>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-xs">
            <div>
              <dt className="text-slate-400">Checked in</dt>
              <dd className="font-medium text-slate-700">
                {fmtTime(job.createdAt)}
                {job.createdBy?.name ? ` by ${job.createdBy.name}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Worked on by</dt>
              <dd className="font-medium text-slate-700">{job.assignedTo?.name || "—"}</dd>
            </div>
            {job.completedAt && (
              <div>
                <dt className="text-slate-400">Ready</dt>
                <dd className="font-medium text-slate-700">
                  {fmtDate(job.completedAt)}, {fmtTime(job.completedAt)}
                </dd>
              </div>
            )}
            {job.deliveredAt && (
              <div>
                <dt className="text-slate-400">Delivered</dt>
                <dd className="font-medium text-slate-700">
                  {fmtDate(job.deliveredAt)}, {fmtTime(job.deliveredAt)}
                </dd>
              </div>
            )}
          </dl>
          {job.notes && <p className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">“{job.notes}”</p>}
          <div className="px-4 pb-4">
            <Link href={`/dashboard/service-entry/${job._id}`} className={buttonClass("secondary", "sm", "w-full")}>
              Open job
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
