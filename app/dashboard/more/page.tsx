"use client";

import Link from "next/link";
import { BarChart3, CalendarCheck, ChevronRight, Globe, LogOut, Package, Receipt, Sparkles, UserCircle, Users, Wallet } from "lucide-react";
import { useLowStock, usePendingHandovers, useSession } from "@/app/components/AppShell";
import { Avatar, Badge, Card, Page, SectionTitle } from "@/app/components/ui";
import { can, ROLE_LABEL } from "@/app/lib/roles";

export default function MorePage() {
  const user = useSession();
  const lowStock = useLowStock();
  const handovers = usePendingHandovers();
  const toApprove = can.approveCash(user.role) ? handovers.pending.length : 0;

  const manage = [
    { href: "/dashboard/reports", icon: BarChart3, label: "Reports", sub: "Revenue, profit, top services", show: can.manageStudio(user.role), color: "bg-brand-100 text-brand-700" },
    {
      href: "/dashboard/inventory",
      icon: Package,
      label: "Inventory",
      sub: lowStock.items.length ? `${lowStock.items.length} item(s) need restocking` : "Stock levels and restock alerts",
      show: can.manageStudio(user.role),
      color: "bg-sky-100 text-sky-700",
      badge: lowStock.items.length,
    },
    { href: "/dashboard/expenses", icon: Receipt, label: "Expenses", sub: "Supplies, salaries, rent", show: can.manageStudio(user.role), color: "bg-amber-100 text-amber-700" },
    { href: "/dashboard/services", icon: Sparkles, label: "Services & pricing", sub: "What you offer and for how much", show: can.manageStudio(user.role), color: "bg-violet-100 text-violet-700" },
    { href: "/dashboard/users", icon: Users, label: "Team", sub: "Staff accounts and roles", show: can.manageUsers(user.role), color: "bg-emerald-100 text-emerald-700" },
  ].filter((i) => i.show);

  return (
    <Page title="More">
      <Link href="/dashboard/profile">
        <Card className="flex items-center gap-4 p-4 active:bg-slate-50">
          <Avatar name={user.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
            <Badge tone="brand" className="mt-1">
              {ROLE_LABEL[user.role]}
            </Badge>
          </div>
          <ChevronRight className="size-5 text-slate-300" />
        </Card>
      </Link>

      <SectionTitle>Work &amp; money</SectionTitle>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        <MenuRow
          href="/dashboard/attendance"
          icon={CalendarCheck}
          label="Attendance"
          sub={can.manageStudio(user.role) ? "Sign in/out, team register & payroll" : "Sign in / out and your hours"}
          color="bg-brand-100 text-brand-700"
        />
        <MenuRow
          href="/dashboard/cash"
          icon={Wallet}
          label="Cash & handover"
          sub={
            toApprove
              ? `${toApprove} handover(s) waiting for your approval`
              : can.approveCash(user.role)
                ? "Approve handovers, see who holds cash"
                : handovers.pending.length
                  ? "Your handover is waiting for approval"
                  : "Hand over collected cash at end of day"
          }
          color="bg-emerald-100 text-emerald-700"
          badge={toApprove}
        />
      </Card>

      {manage.length > 0 && (
        <>
          <SectionTitle>Manage studio</SectionTitle>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {manage.map((i) => (
              <MenuRow key={i.href} {...i} />
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Account</SectionTitle>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        <MenuRow href="/dashboard/profile" icon={UserCircle} label="Profile & password" color="bg-slate-100 text-slate-600" />
        <MenuRow href="/" icon={Globe} label="Studio website" color="bg-slate-100 text-slate-600" />
        <Link href="/logout" className="flex items-center gap-3 px-4 py-3.5 text-red-600 active:bg-red-50">
          <span className="flex size-9 items-center justify-center rounded-xl bg-red-50">
            <LogOut className="size-[18px]" />
          </span>
          <span className="font-medium">Log out</span>
        </Link>
      </Card>

      <p className="mt-8 text-center text-xs text-slate-400">Quick Shine Studio · v1.0</p>
    </Page>
  );
}

function MenuRow({
  href,
  icon: Icon,
  label,
  sub,
  color,
  badge,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  sub?: string;
  color: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
      <span className={`flex size-9 items-center justify-center rounded-xl ${color}`}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-800">{label}</p>
        {sub && <p className={`truncate text-xs ${badge ? "font-medium text-red-600" : "text-slate-500"}`}>{sub}</p>}
      </div>
      {!!badge && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}
      <ChevronRight className="size-4 text-slate-300" />
    </Link>
  );
}
