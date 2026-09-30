"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Bike as BikeIcon, Crown, MessageCircle, Phone, Plus, Star, Wrench } from "lucide-react";
import { accentFor, customerTier } from "@/app/components/bikes";
import BikeFormSheet from "@/app/components/BikeFormSheet";
import { Avatar, Button, Card, Chips, EmptyState, ErrorState, Fab, Page, SearchInput, Select, Skeleton, cn } from "@/app/components/ui";
import { useApi } from "@/app/lib/api";
import { fmtAgo, inr, phoneDigits } from "@/app/lib/format";
import type { Bike } from "@/app/lib/types";

type Filter = "all" | "studio" | "due" | "regular" | "new";
type Sort = "recent" | "visits" | "spent" | "az";

export default function BikesPage() {
  return (
    <Suspense>
      <BikesList />
    </Suspense>
  );
}

function BikesList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, loading, error, reload } = useApi<Bike[]>("/api/bikes");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  // Dashboard "Add bike" quick action → /dashboard/bikes?add=1
  const [formOpen, setFormOpen] = useState(() => !!params.get("add"));

  const all = useMemo(() => data || [], [data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      studio: all.filter((b) => b.inStudio).length,
      due: all.filter((b) => (b.due || 0) > 0).length,
      regular: all.filter((b) => (b.visits || 0) >= 3).length,
      new: all.filter((b) => (b.visits || 0) <= 1).length,
    }),
    [all],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const compactQ = q.replace(/[^a-z0-9]/g, "");
    const list = all.filter((b) => {
      if (filter === "studio" && !b.inStudio) return false;
      if (filter === "due" && !((b.due || 0) > 0)) return false;
      if (filter === "regular" && (b.visits || 0) < 3) return false;
      if (filter === "new" && (b.visits || 0) > 1) return false;
      if (!q) return true;
      return (
        (compactQ &&
          b.bikeNumber
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .includes(compactQ)) ||
        b.ownerName?.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        b.model?.toLowerCase().includes(q)
      );
    });
    const by: Record<Sort, (a: Bike, b: Bike) => number> = {
      recent: () => 0, // API already returns most recent first
      visits: (a, b) => (b.visits || 0) - (a.visits || 0),
      spent: (a, b) => (b.spent || 0) - (a.spent || 0),
      az: (a, b) => a.bikeNumber.localeCompare(b.bikeNumber),
    };
    return [...list].sort(by[sort]);
  }, [all, search, filter, sort]);

  return (
    <Page
      title="Bikes & customers"
      subtitle={data ? `${data.length} bike${data.length === 1 ? "" : "s"} registered` : undefined}
      wide
      actions={
        <Button size="sm" className="max-lg:hidden" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
          Add bike
        </Button>
      }
    >
      {/* Summary strip */}
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
        <SummaryPill
          label="Registered"
          value={counts.all}
          icon={<BikeIcon className="size-4" />}
          tint="bg-brand-100 text-brand-700"
          onClick={() => setFilter("all")}
        />
        <SummaryPill
          label="In studio now"
          value={counts.studio}
          icon={<Wrench className="size-4" />}
          tint="bg-sky-100 text-sky-700"
          onClick={() => setFilter("studio")}
        />
        <SummaryPill
          label="Regulars"
          value={counts.regular}
          icon={<Star className="size-4" />}
          tint="bg-amber-100 text-amber-700"
          onClick={() => setFilter("regular")}
        />
        <SummaryPill
          label="With dues"
          value={counts.due}
          icon={<Crown className="size-4" />}
          tint="bg-red-100 text-red-600"
          onClick={() => setFilter("due")}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Number, owner, phone" className="min-w-0 flex-1" />
        <div className="w-32 shrink-0">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort bikes" className="h-11 rounded-full pl-4 text-sm">
            <option value="recent">Recent</option>
            <option value="visits">Most visits</option>
            <option value="spent">Top spend</option>
            <option value="az">A → Z</option>
          </Select>
        </div>
      </div>
      <Chips
        className="mt-3"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: counts.all },
          { value: "studio", label: "In studio", count: counts.studio },
          { value: "due", label: "Dues", count: counts.due },
          { value: "regular", label: "Regulars", count: counts.regular },
          { value: "new", label: "New", count: counts.new },
        ]}
      />

      <div className="mt-4">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<BikeIcon />}
              title={search || filter !== "all" ? "No bikes found" : "No bikes yet"}
              text={
                search || filter !== "all" ? "Try another search or filter." : "Bikes are added automatically when you create a job, or add one now."
              }
              action={
                <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
                  Add bike
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <BikeCard key={b._id} bike={b} />
            ))}
          </div>
        )}
      </div>

      <Fab label="Add bike" icon={<Plus className="size-5" />} onClick={() => setFormOpen(true)} />

      <BikeFormSheet
        open={formOpen}
        bike={null}
        onClose={() => {
          setFormOpen(false);
          if (params.get("add")) router.replace("/dashboard/bikes");
        }}
        onSaved={(bike) => router.push(`/dashboard/bikes/${bike._id}`)}
      />
    </Page>
  );
}

function SummaryPill({
  label,
  value,
  icon,
  tint,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-left transition active:scale-95">
      <Card className="flex min-w-36 items-center gap-3 px-4 py-3">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", tint)}>{icon}</span>
        <span>
          <span className="block text-xl font-bold tabular-nums leading-tight text-slate-900">{value}</span>
          <span className="block whitespace-nowrap text-xs text-slate-500">{label}</span>
        </span>
      </Card>
    </button>
  );
}

function BikeCard({ bike }: { bike: Bike }) {
  const tier = customerTier(bike.visits);
  const phone = phoneDigits(bike.phone);
  const due = bike.due || 0;

  return (
    <Card className="overflow-hidden rounded-3xl transition hover:shadow-md">
      <Link href={`/dashboard/bikes/${bike._id}`} className="block active:opacity-90">
        {/* Header band with the plate */}
        <div className={cn("relative bg-linear-to-br px-4 pb-5 pt-4 text-white", accentFor(bike.bikeNumber))}>
          <BikeIcon className="pointer-events-none absolute -bottom-4 -right-3 size-28 text-white/10" strokeWidth={1.5} />
          <div className="flex items-start justify-between gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", tier.cls)}>
              <tier.icon className="size-3" /> {tier.label}
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {bike.inStudio && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-emerald-950">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-950" /> In studio
                </span>
              )}
              {due > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{inr(due)} due</span>}
            </div>
          </div>
          <div className="mt-4 inline-flex rounded-lg border-[3px] border-slate-900 bg-white px-3 py-1 font-mono text-xl font-extrabold tracking-widest text-slate-900 shadow-lg shadow-black/20">
            {bike.bikeNumber}
          </div>
          <p className="mt-2 truncate text-sm font-medium text-white/90">{bike.model || "Model not added"}</p>
        </div>

        {/* Owner + stats */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-3">
            <Avatar name={bike.ownerName || bike.bikeNumber} className="size-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{bike.ownerName || "Unknown owner"}</p>
              <p className="truncate text-xs text-slate-500">{bike.phone || "No phone"}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50 py-2 text-center">
            <div>
              <dd className="font-bold tabular-nums text-slate-900">{bike.visits || 0}</dd>
              <dt className="text-[11px] text-slate-500">Visits</dt>
            </div>
            <div>
              <dd className="truncate px-1 font-bold tabular-nums text-slate-900">{inr(bike.spent || 0)}</dd>
              <dt className="text-[11px] text-slate-500">Spent</dt>
            </div>
            <div>
              <dd className="truncate px-1 text-sm font-bold text-slate-900">{bike.lastVisit ? fmtAgo(bike.lastVisit) : "—"}</dd>
              <dt className="text-[11px] text-slate-500">Last visit</dt>
            </div>
          </dl>
        </div>
      </Link>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 p-4 pt-3">
        <Link
          href={`/dashboard/service-entry/add?bike=${bike._id}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white active:bg-brand-800"
        >
          <Plus className="size-4" /> Job
        </Link>
        {phone ? (
          <>
            <a
              href={`tel:+${phone}`}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-100"
            >
              <Phone className="size-4" /> Call
            </a>
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
            >
              <MessageCircle className="size-4" /> Chat
            </a>
          </>
        ) : (
          <Link
            href={`/dashboard/bikes/${bike._id}`}
            className="col-span-2 flex h-10 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500"
          >
            Add phone number
          </Link>
        )}
      </div>
    </Card>
  );
}
