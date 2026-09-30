"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, History, Phone, Plus, Sparkles, UserPlus, X } from "lucide-react";
import { useLowStock, useSession } from "@/app/components/AppShell";
import { useToast } from "@/app/components/overlays";
import {
  Button,
  Card,
  Field,
  Input,
  MoneyInput,
  Page,
  Plate,
  SectionTitle,
  Segmented,
  Select,
  Skeleton,
  Textarea,
  cn,
} from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { STATUS_META, calcTotals, type DiscountType, type JobStatus, type PaymentType } from "@/app/lib/jobs";
import { fmtDate, inr } from "@/app/lib/format";
import type { Bike, Service, TeamMember } from "@/app/lib/types";

const CATEGORY_LABEL: Record<Service["category"], string> = {
  basic: "Wash & basic",
  premium: "Premium detailing",
  addon: "Add-ons",
};

const compact = (s?: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

type Line = { serviceId: string; name: string; price: string };

export default function NewJobPage() {
  return (
    <Suspense>
      <NewJobForm />
    </Suspense>
  );
}

function NewJobForm() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useSession();
  const toast = useToast();
  const lowStock = useLowStock();

  const bikes = useApi<Bike[]>("/api/bikes");
  const services = useApi<Service[]>("/api/services");
  const team = useApi<TeamMember[]>("/api/users?lite=1");

  // ── Bike ──
  const [bikeQuery, setBikeQuery] = useState("");
  const [bike, setBike] = useState<Bike | null>(null);
  const [newBike, setNewBike] = useState({ ownerName: "", phone: "", model: "" });
  const bikeInputRef = useRef<HTMLInputElement>(null);
  const bikeSectionRef = useRef<HTMLDivElement>(null);

  // ── Services & bill ──
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>("flat");
  const [discount, setDiscount] = useState("");

  // ── Payment & workflow ──
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [advance, setAdvance] = useState("");
  const [status, setStatus] = useState<JobStatus>("in_progress");
  const [assignedTo, setAssignedTo] = useState(user.id);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-select a bike when coming from the bike's page (?bike=<id>)
  const preselect = params.get("bike");
  useEffect(() => {
    if (!preselect || !bikes.data || bike) return;
    const found = bikes.data.find((b) => b._id === preselect);
    if (found) setBike(found);
  }, [preselect, bikes.data, bike]);

  const q = compact(bikeQuery);
  const suggestions = useMemo(() => {
    if (!bikes.data) return [];
    const raw = bikeQuery.trim().toLowerCase();
    if (!raw) return bikes.data.slice(0, 6); // most recent visitors
    const digits = raw.replace(/\D/g, "");
    return bikes.data
      .filter(
        (b) =>
          (q && compact(b.bikeNumber).includes(q)) ||
          (digits.length >= 4 && b.phone?.replace(/\D/g, "").includes(digits)) ||
          b.ownerName?.toLowerCase().includes(raw)
      )
      .sort((a, b) => Number(compact(b.bikeNumber).startsWith(q)) - Number(compact(a.bikeNumber).startsWith(q)))
      .slice(0, 6);
  }, [bikes.data, bikeQuery, q]);

  const exactMatch = bikes.data?.find((b) => compact(b.bikeNumber) === q);
  const isNewBike = !bike && q.length >= 4 && !exactMatch;

  const selectBike = (b: Bike) => {
    setBike(b);
    setBikeQuery("");
  };

  const clearBike = () => {
    setBike(null);
    setTimeout(() => bikeInputRef.current?.focus(), 50);
  };

  // ── Services ──
  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = {};
    for (const s of services.data || []) (g[s.category] ||= []).push(s);
    return (["basic", "premium", "addon"] as const).filter((c) => g[c]?.length).map((c) => ({ category: c, items: g[c] }));
  }, [services.data]);

  const toggleService = (s: Service) => {
    setLines((prev) =>
      prev.some((l) => l.serviceId === s._id)
        ? prev.filter((l) => l.serviceId !== s._id)
        : [...prev, { serviceId: s._id, name: s.name, price: String(s.price) }]
    );
  };

  const totals = calcTotals(
    lines.map((l) => Number(l.price) || 0),
    Number(discount) || 0,
    discountType
  );

  // ── Save ──
  const canSave = (bike || isNewBike) && lines.length > 0;

  const save = async () => {
    if (!bike && !isNewBike) {
      toast("Enter the bike number first", "error");
      bikeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      bikeInputRef.current?.focus();
      return;
    }
    if (lines.length === 0) {
      toast("Pick at least one service", "error");
      return;
    }
    const phoneDigits = newBike.phone.replace(/\D/g, "");
    if (isNewBike && phoneDigits && phoneDigits.length < 10) {
      toast("Phone number looks incomplete", "error");
      return;
    }

    setSaving(true);
    try {
      const job = await api<{ _id: string; jobNo: number; lowStock: { name: string }[] }>("/api/service-entry", {
        method: "POST",
        body: {
          bikeId: bike?._id,
          bike: bike ? undefined : { bikeNumber: bikeQuery, ...newBike },
          services: lines.map((l) => ({ serviceId: l.serviceId, price: Number(l.price) || 0 })),
          discount: Number(discount) || 0,
          discountType,
          paymentType,
          advance: paymentType === "due" ? Number(advance) || 0 : 0,
          status,
          assignedTo,
          notes,
        },
      });
      toast(`Job #${job.jobNo} created`);
      if (job.lowStock?.length) {
        toast(`Low stock: ${job.lowStock.map((i) => i.name).join(", ")} — restock soon`, "error");
        lowStock.reload();
      }
      router.replace(`/dashboard/service-entry/${job._id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  };

  return (
    <Page title="New job" back="/dashboard/service-entry" className="pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-32">
      {/* ─────────── 1. Bike ─────────── */}
      <div ref={bikeSectionRef}>
        <SectionTitle>1 · Bike</SectionTitle>
        {bike ? (
          <Card className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Plate number={bike.bikeNumber} size="lg" />
              <p className="mt-2 truncate text-sm font-medium text-slate-800">
                {[bike.model, bike.ownerName].filter(Boolean).join(" · ") || "No details"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                {bike.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" /> {bike.phone}
                  </span>
                )}
                {bike.visits ? (
                  <span className="flex items-center gap-1">
                    <History className="size-3" /> {bike.visits} visit(s)
                    {bike.lastVisit && `, last ${fmtDate(bike.lastVisit)}`}
                  </span>
                ) : (
                  <span>First visit</span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearBike}>
              Change
            </Button>
          </Card>
        ) : (
          <Card className="p-4">
            <Input
              ref={bikeInputRef}
              value={bikeQuery}
              onChange={(e) => setBikeQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (exactMatch) selectBike(exactMatch);
                  else if (suggestions.length === 1 && bikeQuery) selectBike(suggestions[0]);
                }
              }}
              placeholder="Bike number, e.g. WB 02 AB 1234"
              autoFocus={!preselect}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-14 font-mono text-lg font-bold tracking-wider placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
            />
            <p className="mt-2 text-xs text-slate-500">You can also search by owner name or phone.</p>

            {bikes.loading && !bikes.data ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {bikeQuery ? "Matching bikes" : "Recent visitors"}
                  </p>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
                    {suggestions.map((b) => (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => selectBike(b)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-brand-50"
                      >
                        <Plate number={b.bikeNumber} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                          {[b.model, b.ownerName].filter(Boolean).join(" · ")}
                        </span>
                        <Plus className="size-4 shrink-0 text-brand-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {isNewBike && (
              <div className="mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <UserPlus className="size-4" /> New customer — {bikeQuery.trim()}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Owner name">
                    <Input
                      value={newBike.ownerName}
                      onChange={(e) => setNewBike({ ...newBike, ownerName: e.target.value })}
                      placeholder="Customer name"
                      autoCapitalize="words"
                    />
                  </Field>
                  <Field label="Mobile">
                    <Input
                      value={newBike.phone}
                      onChange={(e) => setNewBike({ ...newBike, phone: e.target.value.replace(/[^\d+ ]/g, "") })}
                      placeholder="10-digit number"
                      type="tel"
                      inputMode="tel"
                      maxLength={14}
                    />
                  </Field>
                  <Field label="Bike model" className="sm:col-span-2">
                    <Input
                      value={newBike.model}
                      onChange={(e) => setNewBike({ ...newBike, model: e.target.value })}
                      placeholder="e.g. Royal Enfield Classic 350"
                    />
                  </Field>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ─────────── 2. Services ─────────── */}
      <SectionTitle>2 · Services</SectionTitle>
      {services.loading && !services.data ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-5 text-center text-sm text-slate-500">
          No services set up yet. Ask the owner or a manager to add them under More → Services.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.category}>
              <p className="mb-2 px-1 text-xs font-medium text-slate-400">{CATEGORY_LABEL[g.category]}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {g.items.map((s) => {
                  const on = lines.some((l) => l.serviceId === s._id);
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => toggleService(s)}
                      aria-pressed={on}
                      className={cn(
                        "relative flex min-h-20 flex-col justify-between rounded-2xl border-2 p-3 text-left transition active:scale-[0.97]",
                        on ? "border-brand-600 bg-brand-50" : "border-slate-200/80 bg-white"
                      )}
                    >
                      <span className={cn("pr-6 text-sm font-semibold leading-snug", on ? "text-brand-800" : "text-slate-800")}>
                        {s.name}
                      </span>
                      <span className={cn("mt-1 text-sm font-bold tabular-nums", on ? "text-brand-600" : "text-slate-500")}>
                        {inr(s.price)}
                      </span>
                      <span
                        className={cn(
                          "absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full border-2 transition",
                          on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────── 3. Bill ─────────── */}
      {lines.length > 0 && (
        <>
          <SectionTitle>3 · Bill</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <div key={l.serviceId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{l.name}</span>
                <div className="relative w-28">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={l.price}
                    aria-label={`Price for ${l.name}`}
                    onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-6 pr-2 text-right text-base font-semibold tabular-nums outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${l.name}`}
                  onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                  className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}

            <div className="space-y-3 px-4 py-3">
              <div className="flex items-center gap-2">
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
                  min={0}
                  value={discount}
                  placeholder="0"
                  aria-label="Discount"
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right text-base font-semibold tabular-nums outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(discountType === "flat" ? [0, 50, 100, 200] : [0, 5, 10, 15]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDiscount(v ? String(v) : "")}
                    className={cn(
                      "h-8 rounded-full border px-3 text-xs font-semibold",
                      (Number(discount) || 0) === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600"
                    )}
                  >
                    {v === 0 ? "None" : discountType === "flat" ? `₹${v}` : `${v}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 bg-slate-50/70 px-4 py-3 text-sm">
              <Row label="Subtotal" value={inr(totals.subtotal)} />
              {totals.discountAmount > 0 && <Row label="Discount" value={`− ${inr(totals.discountAmount)}`} className="text-emerald-600" />}
              <Row label="Total" value={inr(totals.total)} className="pt-1 text-base font-bold text-slate-900" />
            </div>
          </Card>
        </>
      )}

      {/* ─────────── 4. Payment & status ─────────── */}
      <SectionTitle>{lines.length > 0 ? "4" : "3"} · Payment & status</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Payment">
          <Segmented
            value={paymentType}
            onChange={setPaymentType}
            options={[
              { value: "cash", label: "Cash" },
              { value: "online", label: "UPI / Online" },
              { value: "due", label: "Pay later" },
            ]}
          />
        </Field>
        {paymentType === "due" && (
          <Field label="Advance received (cash)" hint="Leave empty if nothing was paid yet">
            <MoneyInput value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" />
          </Field>
        )}

        <Field label="Job status">
          <Segmented
            value={status}
            onChange={setStatus}
            size="sm"
            options={(["pending", "in_progress", "completed", "delivered"] as JobStatus[]).map((s) => ({
              value: s,
              label: STATUS_META[s].short,
            }))}
          />
        </Field>

        <Field label="Assigned to">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            {(team.data || [{ _id: user.id, name: user.name }]).map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
                {m._id === user.id ? " (me)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {showNotes ? (
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Scratches on tank, customer wants it by 5pm…"
              autoFocus
            />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowNotes(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-600">
            <ChevronDown className="size-4" /> Add a note
          </button>
        )}
      </Card>

      {/* ─────────── Sticky save bar ─────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">
              {lines.length} service{lines.length === 1 ? "" : "s"}
              {paymentType === "due" ? " · pay later" : ""}
            </p>
            <p className="text-xl font-bold tabular-nums text-slate-900">{inr(totals.total)}</p>
          </div>
          <Button size="lg" onClick={save} loading={saving} disabled={!canSave} icon={!saving && <Sparkles className="size-5" />} className="min-w-40">
            Save job
          </Button>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between tabular-nums text-slate-600", className)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
