"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bike,
  ClipboardList,
  Hourglass,
  PackageCheck,
  Plus,
  Receipt,
  Wallet,
  Wrench,
} from "lucide-react";
import { useLowStock, usePendingHandovers, useSession } from "@/app/components/AppShell";
import { RankList, RevenueChart, type Report } from "@/app/components/charts";
import { LowStockAlert } from "@/app/components/inventory";
import { JobCard } from "@/app/components/jobs";
import { Avatar, Card, Chips, EmptyState, ErrorState, ListSkeleton, SectionTitle, Skeleton, Stat, cn } from "@/app/components/ui";
import { useApi } from "@/app/lib/api";
import { can } from "@/app/lib/roles";
import { greeting, inr, rangeFor, rangeQuery, type RangePreset } from "@/app/lib/format";
import type { Job } from "@/app/lib/types";

type Stats = {
  jobs: number;
  delivered: number;
  statusCounts: Record<"pending" | "in_progress" | "completed", number>;
  billed?: number;
  collected?: { cash: number; online: number; total: number };
  expenses?: number;
  net?: number;
  dues?: { count: number; amount: number };
};

export default function DashboardHome() {
  const user = useSession();
  const isManager = can.manageStudio(user.role);
  const todayQuery = useMemo(() => rangeQuery(rangeFor("today")), []);

  const stats = useApi<Stats>(`/api/stats?${todayQuery}`);
  const active = useApi<Job[]>("/api/service-entry?view=active");
  const lowStock = useLowStock();

  const s = stats.data;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const pipeline = [
    { key: "pending", label: "Waiting", icon: Hourglass, cls: "bg-amber-50 text-amber-700" },
    { key: "in_progress", label: "Working", icon: Wrench, cls: "bg-sky-50 text-sky-700" },
    { key: "completed", label: "Ready", icon: PackageCheck, cls: "bg-violet-50 text-violet-700" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] lg:px-8 lg:pb-10 lg:pt-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{today}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/dashboard/more" className="lg:hidden" aria-label="Account">
          <Avatar name={user.name} className="size-11" />
        </Link>
      </div>

      {/* Hero card */}
      <div className="mt-5 overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lg shadow-brand-900/20">
        {stats.loading && !s ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32 bg-white/20" />
            <Skeleton className="h-9 w-44 bg-white/20" />
            <Skeleton className="h-4 w-56 bg-white/20" />
          </div>
        ) : isManager ? (
          <>
            <p className="text-sm text-white/70">Collected today</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{inr(s?.collected?.total)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <HeroFigure label="Cash" value={inr(s?.collected?.cash)} />
              <HeroFigure label="Online" value={inr(s?.collected?.online)} />
              <HeroFigure label="Billed" value={inr(s?.billed)} />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/70">Jobs today</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{s?.jobs ?? 0}</p>
            <p className="mt-2 text-sm text-white/80">{s?.delivered ?? 0} delivered so far</p>
          </>
        )}
      </div>

      {/* Cash custody */}
      <CashCard />

      {/* Inventory alert */}
      {isManager && lowStock.items.length > 0 && (
        <div className="mt-4">
          <LowStockAlert items={lowStock.items} />
        </div>
      )}

      {/* Workflow pipeline */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {pipeline.map((p) => (
          <Link key={p.key} href={`/dashboard/service-entry?tab=active&status=${p.key}`}>
            <Card className="flex flex-col items-center gap-1 p-3 text-center transition active:scale-95">
              <span className={cn("flex size-9 items-center justify-center rounded-xl", p.cls)}>
                <p.icon className="size-[18px]" />
              </span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">{s?.statusCounts?.[p.key] ?? "–"}</span>
              <span className="text-xs font-medium text-slate-500">{p.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Manager KPIs */}
      {isManager && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Jobs today" value={s?.jobs ?? "–"} icon={<ClipboardList className="size-4" />} />
          <Stat label="Expenses today" value={inr(s?.expenses)} icon={<Receipt className="size-4" />} tone="amber" href="/dashboard/expenses" />
          <Stat
            label="Net today"
            value={<span className={(s?.net ?? 0) < 0 ? "text-red-600" : undefined}>{inr(s?.net)}</span>}
            sub="Collected − expenses"
            icon={<Wallet className="size-4" />}
            tone="green"
          />
          <Stat
            label="Pending dues"
            value={inr(s?.dues?.amount)}
            sub={`${s?.dues?.count ?? 0} job(s)`}
            icon={<AlertCircle className="size-4" />}
            tone="red"
            href="/dashboard/service-entry?tab=due"
          />
        </div>
      )}

      {/* Sales report */}
      {isManager && <SalesReport />}

      {/* Quick actions */}
      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <QuickAction href="/dashboard/service-entry/add" icon={Plus} label="New job" primary />
        <QuickAction href="/dashboard/bikes?add=1" icon={Bike} label="Add bike" />
        {isManager ? (
          <>
            <QuickAction href="/dashboard/expenses?add=1" icon={Receipt} label="Expense" />
            <QuickAction href="/dashboard/reports" icon={BarChart3} label="Reports" />
          </>
        ) : (
          <QuickAction href="/dashboard/service-entry?tab=history" icon={ClipboardList} label="Today" />
        )}
      </div>

      {/* Active jobs */}
      <SectionTitle
        action={
          <Link href="/dashboard/service-entry" className="flex items-center gap-1 text-sm font-semibold text-brand-600">
            See all <ArrowRight className="size-4" />
          </Link>
        }
      >
        In the studio now
      </SectionTitle>
      {active.loading && !active.data ? (
        <ListSkeleton rows={3} />
      ) : active.data && active.data.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.data.slice(0, 8).map((job) => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Bike />}
            title="No bikes in the studio"
            text="Tap the + button to start a new job when a bike comes in."
          />
        </Card>
      )}
    </div>
  );
}

function HeroFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <p className="text-xs text-white/60">{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, primary }: { href: string; icon: typeof Plus; label: string; primary?: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 text-center transition active:scale-95">
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          primary ? "bg-brand-600 text-white shadow-md shadow-brand-900/20" : "border border-slate-200/70 bg-white text-brand-600 shadow-sm"
        )}
      >
        <Icon className="size-6" />
      </span>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </Link>
  );
}

const SALES_RANGES: { value: Exclude<RangePreset, "custom" | "yesterday" | "lastMonth">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "This month" },
];

function SalesReport() {
  const [preset, setPreset] = useState<(typeof SALES_RANGES)[number]["value"]>("week");
  const query = useMemo(() => rangeQuery(rangeFor(preset)), [preset]);
  const tz = useMemo(() => new Date().getTimezoneOffset(), []);
  const { data, loading, error, reload } = useApi<Report>(`/api/reports?${query}&tz=${tz}`);
  const s = data?.summary;
  const cashShare = s && s.collected.total > 0 ? (s.collected.cash / s.collected.total) * 100 : 0;

  return (
    <>
      <SectionTitle
        action={
          <Link href="/dashboard/reports" className="flex items-center gap-1 text-sm font-semibold text-brand-600">
            Full report <ArrowRight className="size-4" />
          </Link>
        }
      >
        Sales report
      </SectionTitle>
      <Chips value={preset} onChange={setPreset} options={SALES_RANGES} />

      {error && !s ? (
        <div className="mt-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !s ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className={cn("mt-3 space-y-3 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sales (billed)" value={inr(s.billed)} sub={s.discounts ? `${inr(s.discounts)} discount` : undefined} />
            <Stat label="Collected" value={inr(s.collected.total)} tone="green" />
            <Stat label="Jobs done" value={s.jobs} tone="violet" />
            <Stat label="Avg per job" value={inr(Math.round(s.avgTicket))} tone="amber" />
          </div>

          {preset !== "today" && <RevenueChart points={data.series.points} unit={data.series.unit} />}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700">Payment split</p>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {s.collected.total > 0 && (
                  <>
                    <span className="h-full bg-brand-600" style={{ width: `${cashShare}%` }} />
                    <span className="h-full border-l-2 border-white bg-brand-300" style={{ width: `${100 - cashShare}%` }} />
                  </>
                )}
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="size-2.5 rounded-full bg-brand-600" /> Cash <b className="tabular-nums text-slate-900">{inr(s.collected.cash)}</b>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="size-2.5 rounded-full bg-brand-300" /> UPI / Online <b className="tabular-nums text-slate-900">{inr(s.collected.online)}</b>
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">Expenses</span>
                <span className="font-semibold tabular-nums text-slate-800">{inr(s.expenses)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-slate-500">Profit (billed − expenses)</span>
                <span className={cn("font-bold tabular-nums", s.profit < 0 ? "text-red-600" : "text-emerald-600")}>{inr(s.profit)}</span>
              </div>
            </Card>
            <div>
              <RankList
                empty="No services sold yet"
                rows={data.services.slice(0, 5).map((x) => ({ label: x.name, value: x.revenue, detail: `${x.count}×` }))}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Approvers: handovers waiting. Everyone else: cash they are holding, with a nudge to hand it over. */
function CashCard() {
  const user = useSession();
  const { pending } = usePendingHandovers();
  const approver = can.approveCash(user.role);
  const today = useMemo(() => rangeQuery(rangeFor("today")), []);
  const mine = useApi<{ me: { inHand: number; available: number; pending: number } | null }>(approver ? null : `/api/cash?${today}`);

  if (approver) {
    if (!pending.length) return null;
    const total = pending.reduce((s, h) => s + h.amount, 0);
    return (
      <Link href="/dashboard/cash" className="mt-4 block">
        <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 transition active:scale-[0.99]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-800">
              {pending.length} cash handover{pending.length > 1 ? "s" : ""} to approve
            </p>
            <p className="truncate text-sm text-slate-600">
              {inr(total)} from {[...new Set(pending.map((h) => h.from?.name).filter(Boolean))].join(", ")}
            </p>
          </div>
          <ArrowRight className="size-5 text-emerald-600" />
        </Card>
      </Link>
    );
  }

  const me = mine.data?.me;
  if (!me || me.inHand <= 0) return null;
  return (
    <Link href="/dashboard/cash" className="mt-4 block">
      <Card className="flex items-center gap-3 p-4 transition active:scale-[0.99]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            Cash in your hand: <span className="tabular-nums">{inr(me.inHand)}</span>
          </p>
          <p className="text-sm text-slate-500">
            {me.pending > 0 ? `${inr(me.pending)} waiting for approval` : "Hand it over to the Super Admin / Admin at end of day"}
          </p>
        </div>
        <ArrowRight className="size-5 text-slate-400" />
      </Card>
    </Link>
  );
}
