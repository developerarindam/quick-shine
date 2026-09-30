import type { ReactNode } from "react";

/** Full-screen app-style auth layout: brand header on top, form sheet below (card on desktop). */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 sm:items-center sm:justify-center sm:p-6">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center text-white sm:flex-none sm:pt-0">
        <div className="rounded-3xl bg-white p-4 shadow-xl shadow-brand-900/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Quick Shine" width={120} height={80} className="h-20 w-auto" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-white/70">{subtitle}</p>
      </div>
      <div className="rounded-t-[2rem] bg-white px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 shadow-2xl sm:w-full sm:max-w-sm sm:rounded-3xl sm:pb-8">
        {children}
      </div>
    </div>
  );
}
