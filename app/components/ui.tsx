"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/app/lib/jobs";
import { initials } from "@/app/lib/format";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ───────────── Buttons ───────────── */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-900/10",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ className, label, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200",
        className
      )}
      {...props}
    />
  );
}

/* ───────────── Page chrome ───────────── */

/**
 * Sticky app bar (mobile) / page title (desktop) + padded content area.
 */
export function Page({
  title,
  subtitle,
  back,
  actions,
  children,
  className,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | true;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const router = useRouter();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg print:hidden lg:border-none lg:bg-transparent lg:backdrop-blur-none">
        <div className={cn("mx-auto flex h-14 items-center gap-1 px-2 lg:h-20 lg:px-8", wide ? "max-w-6xl" : "max-w-4xl")}>
          {back &&
            (typeof back === "string" ? (
              <Link href={back} aria-label="Back" className="inline-flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100">
                <ArrowLeft className="size-5" />
              </Link>
            ) : (
              <IconButton label="Back" onClick={() => router.back()} className="text-slate-700">
                <ArrowLeft className="size-5" />
              </IconButton>
            ))}
          <div className={cn("min-w-0 flex-1", !back && "pl-2 lg:pl-0")}>
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 lg:text-2xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-slate-500 lg:text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1 pr-1 lg:gap-2 lg:pr-0">{actions}</div>}
        </div>
      </header>
      <div
        className={cn(
          "mx-auto px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10",
          wide ? "max-w-6xl" : "max-w-4xl",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-900/[0.03]", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

/* ───────────── Form controls ───────────── */

const CONTROL =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(CONTROL, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10", className)} {...props} />;
}

/** ₹ amount input with a large, thumb-friendly target */
export function MoneyInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
      <input type="number" inputMode="decimal" min={0} className={cn(CONTROL, "h-12 pl-8 tabular-nums", className)} {...props} />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL, "h-11 rounded-full bg-white pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** iOS-style segmented control */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex rounded-xl bg-slate-100 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all",
            size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontally scrolling filter chips */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
            value === o.value
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-xs", value === o.value ? "bg-white/20" : "bg-slate-100")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-300")}
    >
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ───────────── Display ───────────── */

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-600",
  brand: "bg-brand-100 text-brand-700",
};

export const TONE_DOT: Record<Tone, string> = {
  gray: "bg-slate-400",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  brand: "bg-brand-500",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Indian number-plate style bike number */
export function Plate({ number, size = "md" }: { number: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border-2 border-slate-800 bg-white font-mono font-bold uppercase tracking-wider text-slate-900",
        size === "sm" && "px-1.5 py-px text-xs",
        size === "md" && "px-2 py-0.5 text-sm",
        size === "lg" && "px-3 py-1 text-xl"
      )}
    >
      {number}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700", className)}>
      {initials(name) || "?"}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <Card className={cn("h-full p-4", href && "transition active:scale-[0.98]")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && <span className={cn("flex size-8 items-center justify-center rounded-lg", TONES[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 [&>svg]:size-8">{icon}</div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** Floating action button, sits above the bottom nav on mobile */
export function Fab({ onClick, href, label, icon }: { onClick?: () => void; href?: string; label: string; icon: ReactNode }) {
  const cls =
    "fixed right-4 z-30 flex h-14 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-brand-900/25 transition active:scale-95 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8 print:hidden";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icon}
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
