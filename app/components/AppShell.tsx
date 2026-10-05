"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  BarChart3,
  Bike,
  ClipboardList,
  Home,
  LayoutGrid,
  LogOut,
  Plus,
  Package,
  Wallet,
  Receipt,
  Sparkles,
  UserCircle,
  Users,
} from "lucide-react";
import { can, ROLE_LABEL, type SessionUser } from "@/app/lib/roles";
import { useApi } from "@/app/lib/api";
import type { LowStockItem } from "@/app/lib/types";
import { OverlayProvider } from "./overlays";
import { Avatar, cn } from "./ui";

const SessionCtx = createContext<SessionUser | null>(null);

const LowStockCtx = createContext<{ items: LowStockItem[]; reload: () => void }>({ items: [], reload: () => {} });

/** Items at/below their reorder level (always empty for staff). */
type PendingHandover = { _id: string; amount: number; from: { _id: string; name: string } | null; createdAt: string };
const HandoverCtx = createContext<{ pending: PendingHandover[]; reload: () => void }>({ pending: [], reload: () => {} });

/** Cash handovers waiting: for Super Admin / Admin the ones to approve, for staff their own. */
export function usePendingHandovers() {
  return useContext(HandoverCtx);
}

export function useLowStock() {
  return useContext(LowStockCtx);
}

export function useSession() {
  const user = useContext(SessionCtx);
  if (!user) throw new Error("useSession must be used inside AppShell");
  return user;
}

type NavItem = { name: string; href: string; icon: typeof Home; show?: (u: SessionUser) => boolean };

const SIDEBAR: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Jobs", href: "/dashboard/service-entry", icon: ClipboardList },
  { name: "Bikes & Customers", href: "/dashboard/bikes", icon: Bike },
  { name: "Services", href: "/dashboard/services", icon: Sparkles, show: (u) => can.manageStudio(u.role) },
  { name: "Cash & handover", href: "/dashboard/cash", icon: Wallet },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package, show: (u) => can.manageStudio(u.role) },
  { name: "Expenses", href: "/dashboard/expenses", icon: Receipt, show: (u) => can.manageStudio(u.role) },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, show: (u) => can.manageStudio(u.role) },
  { name: "Team", href: "/dashboard/users", icon: Users, show: (u) => can.manageUsers(u.role) },
  { name: "My profile", href: "/dashboard/profile", icon: UserCircle },
];

const TABS: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Jobs", href: "/dashboard/service-entry", icon: ClipboardList },
  { name: "Bikes", href: "/dashboard/bikes", icon: Bike },
  { name: "More", href: "/dashboard/more", icon: LayoutGrid },
];

const NEW_JOB = "/dashboard/service-entry/add";

// Full-screen flows that bring their own bottom action bar
const hidesTabs = (pathname: string) => pathname === NEW_JOB || pathname.endsWith("/edit");

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/more") {
    return ["/dashboard/more", "/dashboard/cash", "/dashboard/services", "/dashboard/expenses", "/dashboard/inventory", "/dashboard/reports", "/dashboard/users", "/dashboard/profile"].some(
      (p) => pathname.startsWith(p)
    );
  }
  return pathname.startsWith(href) && !(href === "/dashboard/service-entry" && pathname === NEW_JOB);
}

export default function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const hideTabs = hidesTabs(pathname);

  // Low-stock alerts for Super Admin / Admin, refreshed on every navigation
  const lowStock = useApi<LowStockItem[]>(can.manageStudio(user.role) ? "/api/inventory?low=1" : null);
  const reloadLowStock = lowStock.reload;
  const lowItems = lowStock.data || [];

  const handovers = useApi<PendingHandover[]>("/api/cash/handover");
  const reloadHandovers = handovers.reload;

  // Refresh the badges while moving around, but at most every 30s so they never
  // compete with the page's own data on every tap (both load once on mount anyway)
  const lastBadgeRefresh = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (lastBadgeRefresh.current === 0) {
      lastBadgeRefresh.current = now;
      return;
    }
    if (now - lastBadgeRefresh.current < 30_000) return;
    lastBadgeRefresh.current = now;
    reloadLowStock();
    reloadHandovers();
  }, [pathname, reloadLowStock, reloadHandovers]);
  const pendingHandovers = handovers.data || [];
  // badge only when someone needs to act: approvers see requests to approve
  const handoverAlert = can.approveCash(user.role) ? pendingHandovers.length : 0;

  return (
    <SessionCtx.Provider value={user}>
      <LowStockCtx.Provider value={{ items: lowItems, reload: reloadLowStock }}>
      <HandoverCtx.Provider value={{ pending: pendingHandovers, reload: reloadHandovers }}>
      <OverlayProvider>
        <div className="min-h-dvh">
          {/* ── Desktop sidebar ── */}
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
            <Link href="/dashboard" className="flex h-20 items-center gap-3 px-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Sparkles className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-extrabold leading-tight text-slate-900">Quick Shine</span>
                <span className="block text-xs text-slate-500">Detailing Studio</span>
              </span>
            </Link>

            <div className="px-4 pb-4">
              <Link
                href={NEW_JOB}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <Plus className="size-5" /> New job
              </Link>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {SIDEBAR.filter((i) => !i.show || i.show(user)).map((item) => {
                const active =
                  item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href) && pathname !== NEW_JOB;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className="size-5" />
                    <span className="flex-1">{item.name}</span>
                    {item.href === "/dashboard/cash" && handoverAlert > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white" title="Cash handovers to approve">
                        {handoverAlert}
                      </span>
                    )}
                    {item.href === "/dashboard/inventory" && lowItems.length > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white" title="Items low on stock">
                        {lowItems.length}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
                </div>
                <Link
                  href="/logout"
                  aria-label="Log out"
                  title="Log out"
                  className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="size-[18px]" />
                </Link>
              </div>
            </div>
          </aside>

          {/* ── Content ── */}
          <main className="lg:pl-64">{children}</main>

          {/* ── Mobile bottom tab bar ── */}
          {!hideTabs && (
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden print:hidden">
              <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
                {TABS.slice(0, 2).map((t) => (
                  <TabLink key={t.href} item={t} active={isActive(pathname, t.href)} />
                ))}
                <div className="flex justify-center">
                  <Link
                    href={NEW_JOB}
                    aria-label="New job"
                    className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white transition active:scale-90"
                  >
                    <Plus className="size-7" strokeWidth={2.5} />
                  </Link>
                </div>
                {TABS.slice(2).map((t) => (
                  <TabLink key={t.href} item={t} active={isActive(pathname, t.href)} alert={t.href === "/dashboard/more" && (lowItems.length > 0 || handoverAlert > 0)} />
                ))}
              </div>
            </nav>
          )}
        </div>
      </OverlayProvider>
      </HandoverCtx.Provider>
      </LowStockCtx.Provider>
    </SessionCtx.Provider>
  );
}

function TabLink({ item, active, alert }: { item: NavItem; active: boolean; alert?: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
        active ? "text-brand-600" : "text-slate-400"
      )}
    >
      <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-50")}>
        <item.icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        {alert && <span className="absolute right-2.5 top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-label="Low stock alert" />}
      </span>
      {item.name}
    </Link>
  );
}
