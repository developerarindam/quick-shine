"use client";

import { useMemo, useState } from "react";
import { Clock, Package, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyState,
  ErrorState,
  Fab,
  Field,
  Input,
  ListSkeleton,
  MoneyInput,
  Page,
  SearchInput,
  SectionTitle,
  Segmented,
  Select,
  Switch,
  Textarea,
  cn,
} from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { inr } from "@/app/lib/format";
import type { InventoryItem, Service } from "@/app/lib/types";

type Category = Service["category"];
const CATEGORIES: { value: Category; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "addon", label: "Add-on" },
];

type Use = { item: string; qty: string };
const EMPTY = { name: "", price: "", category: "basic" as Category, duration: "", description: "", sortOrder: "", consumes: [] as Use[] };

export default function ServicesClient() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useApi<Service[]>("/api/services?all=1");
  const inventory = useApi<Pick<InventoryItem, "_id" | "name" | "unit">[]>("/api/inventory?lite=1");
  const unitOf = (id: string) => inventory.data?.find((i) => i._id === id)?.unit || "";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () =>
      (data || []).filter(
        (s) => (filter === "all" || s.category === filter) && s.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [data, filter, search]
  );

  const openForm = (s: Service | null) => {
    setEditing(s);
    setForm(
      s
        ? {
            name: s.name,
            price: String(s.price),
            category: s.category,
            duration: s.duration ? String(s.duration) : "",
            description: s.description || "",
            sortOrder: s.sortOrder ? String(s.sortOrder) : "",
            consumes: (s.consumes || []).map((c) => ({ item: String(c.item), qty: String(c.qty) })),
          }
        : EMPTY
    );
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast("Service name is required", "error");
    if (form.price === "") return toast("Enter a price", "error");
    setSaving(true);
    try {
      await api(editing ? `/api/services/${editing._id}` : "/api/services", {
        method: editing ? "PUT" : "POST",
        body: form,
      });
      toast(editing ? "Service updated" : "Service added");
      setOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Service, isActive: boolean) => {
    setData((list) => list?.map((x) => (x._id === s._id ? { ...x, isActive } : x)));
    try {
      await api(`/api/services/${s._id}`, { method: "PUT", body: { isActive } });
      toast(isActive ? `${s.name} is now available` : `${s.name} hidden from new jobs`, "info");
    } catch (e) {
      toast((e as Error).message, "error");
      reload();
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({ title: `Delete ${editing.name}?`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/services/${editing._id}`, { method: "DELETE" });
      toast("Service removed");
      setOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const grouped = CATEGORIES.map((c) => ({ ...c, items: visible.filter((s) => s.category === c.value) })).filter((g) => g.items.length);

  return (
    <Page
      title="Services & pricing"
      back="/dashboard/more"
      actions={
        <Button size="sm" className="max-lg:hidden" icon={<Plus className="size-4" />} onClick={() => openForm(null)}>
          Add service
        </Button>
      }
    >
      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search services" />
        <Chips value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, ...CATEGORIES]} />
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="mt-4">
          <ListSkeleton />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Sparkles />}
            title="No services"
            text="Add the services you offer, like Foam Wash, Ceramic Coating or Chain Lube."
            action={<Button onClick={() => openForm(null)}>Add service</Button>}
          />
        </Card>
      ) : (
        grouped.map((g) => (
          <div key={g.value}>
            <SectionTitle>{g.label}</SectionTitle>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {g.items.map((s) => (
                <div key={s._id} className={cn("flex items-center gap-3 px-4 py-3", !s.isActive && "opacity-60")}>
                  <button type="button" onClick={() => openForm(s)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 font-medium text-slate-800">
                      <span className="truncate">{s.name}</span>
                      {!s.isActive && <Badge>Hidden</Badge>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
                      <span className="font-semibold tabular-nums text-slate-700">{inr(s.price)}</span>
                      {s.duration ? (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {s.duration} min
                        </span>
                      ) : null}
                    </p>
                  </button>
                  <Switch checked={s.isActive} onChange={(v) => toggleActive(s, v)} label={`${s.name} available`} />
                </div>
              ))}
            </Card>
          </div>
        ))
      )}

      <Fab label="Add service" icon={<Plus className="size-5" />} onClick={() => openForm(null)} />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit service" : "New service"}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="lg" onClick={remove} aria-label="Delete service">
                <Trash2 className="size-5" />
              </Button>
            )}
            <Button size="lg" className="flex-1" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Add service"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Foam Wash" autoFocus={!editing} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <MoneyInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Duration (min)">
              <Input type="number" inputMode="numeric" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="30" />
            </Field>
          </div>
          <Field label="Category">
            <Segmented value={form.category} onChange={(category) => setForm({ ...form, category })} options={CATEGORIES} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" className="min-h-20" />
          </Field>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Package className="size-4" /> Uses from inventory
            </p>
            <p className="mb-2 text-xs text-slate-500">Deducted from stock automatically every time this service is added to a job.</p>
            <div className="space-y-2">
              {form.consumes.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={c.item}
                    aria-label="Inventory item"
                    onChange={(e) => setForm({ ...form, consumes: form.consumes.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)) })}
                    className="flex-1"
                  >
                    <option value="">Choose item…</option>
                    {(inventory.data || []).map((it) => (
                      <option key={it._id} value={it._id}>
                        {it.name}
                      </option>
                    ))}
                  </Select>
                  <div className="relative w-28 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      aria-label="Quantity per job"
                      value={c.qty}
                      placeholder="Qty"
                      onChange={(e) => setForm({ ...form, consumes: form.consumes.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })}
                      className="pr-9"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unitOf(c.item)}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setForm({ ...form, consumes: form.consumes.filter((_, j) => j !== i) })}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {inventory.data && inventory.data.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Add items under More → Inventory first.</p>
              ) : (
                <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setForm({ ...form, consumes: [...form.consumes, { item: "", qty: "" }] })}>
                  Add item used
                </Button>
              )}
            </div>
          </div>
          <Field label="Display order" hint="Lower numbers show first on the new-job screen">
            <Input type="number" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="0" />
          </Field>
        </div>
      </Sheet>
    </Page>
  );
}
