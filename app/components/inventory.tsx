"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Brush, Droplets, Minus, Package, Plus, Shield, SprayCan, Wrench, type LucideIcon } from "lucide-react";
import { api } from "@/app/lib/api";
import { inr } from "@/app/lib/format";
import { fmtQty, stockLevel } from "@/app/lib/stock";
import type { InventoryItem, LowStockItem } from "@/app/lib/types";
import { Sheet, useToast } from "./overlays";
import { Badge, Button, Card, Field, Input, MoneyInput, Segmented, Select, Switch, Textarea, cn } from "./ui";

export const INVENTORY_CATEGORIES: { value: string; label: string; icon: LucideIcon; tint: string }[] = [
  { value: "shampoo", label: "Shampoo & foam", icon: Droplets, tint: "bg-sky-100 text-sky-700" },
  { value: "polish", label: "Polish & wax", icon: Brush, tint: "bg-amber-100 text-amber-700" },
  { value: "coating", label: "Coatings", icon: Shield, tint: "bg-violet-100 text-violet-700" },
  { value: "cleaning", label: "Cleaners & lube", icon: SprayCan, tint: "bg-emerald-100 text-emerald-700" },
  { value: "tools", label: "Tools & cloths", icon: Wrench, tint: "bg-slate-200 text-slate-700" },
  { value: "accessories", label: "Accessories", icon: Package, tint: "bg-rose-100 text-rose-700" },
  { value: "other", label: "Other", icon: Package, tint: "bg-slate-100 text-slate-600" },
];
export const UNITS = ["ml", "L", "g", "kg", "pcs", "bottle", "can", "pack"];

export const categoryMeta = (c: string) => INVENTORY_CATEGORIES.find((x) => x.value === c) || INVENTORY_CATEGORIES[6];

export function LevelBadge({ item }: { item: Pick<InventoryItem, "stock" | "minStock"> }) {
  const level = stockLevel(item);
  if (level === "out") return <Badge tone="red">Out of stock</Badge>;
  if (level === "low") return <Badge tone="amber">Low stock</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

/** Stock gauge: full scale is 3× the reorder level (or current stock, whichever is larger). */
export function StockBar({ item }: { item: Pick<InventoryItem, "stock" | "minStock"> }) {
  const level = stockLevel(item);
  const scale = Math.max(item.minStock * 3, item.stock, 1);
  const pct = Math.max(0, Math.min(100, (item.stock / scale) * 100));
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full", level === "out" ? "bg-red-500" : level === "low" ? "bg-amber-500" : "bg-emerald-500")}
        style={{ width: `${Math.max(pct, level === "out" ? 0 : 3)}%` }}
      />
      {item.minStock > 0 && (
        <span className="absolute inset-y-0 w-0.5 bg-slate-400/70" style={{ left: `${(item.minStock / scale) * 100}%` }} />
      )}
    </div>
  );
}

/** Red/amber banner listing items that need restocking. */
export function LowStockAlert({ items, compact }: { items: LowStockItem[]; compact?: boolean }) {
  if (!items.length) return null;
  const out = items.filter((i) => i.stock <= 0).length;
  return (
    <Link href="/dashboard/inventory?filter=low" className="block">
      <Card className={cn("flex gap-3 border-amber-200 bg-amber-50 p-4 transition active:scale-[0.99]", out > 0 && "border-red-200 bg-red-50")}>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", out > 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700")}>
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", out > 0 ? "text-red-700" : "text-amber-800")}>
            {items.length} item{items.length > 1 ? "s" : ""} need restocking
            {out > 0 ? ` · ${out} out of stock` : ""}
          </p>
          {!compact && (
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {items
                .slice(0, 4)
                .map((i) => `${i.name} (${fmtQty(i.stock, i.unit)})`)
                .join(", ")}
              {items.length > 4 ? ` +${items.length - 4} more` : ""}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

/* ───────────── Add / edit item ───────────── */

const EMPTY_ITEM = { name: "", category: "shampoo", unit: "ml", stock: "", minStock: "", costPerUnit: "", supplier: "", notes: "" };

export function ItemFormSheet({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            unit: item.unit,
            stock: String(item.stock),
            minStock: item.minStock ? String(item.minStock) : "",
            costPerUnit: item.costPerUnit !== undefined ? String(item.costPerUnit) : "",
            supplier: item.supplier || "",
            notes: item.notes || "",
          }
        : EMPTY_ITEM
    );
  }, [open, item]);

  const save = async () => {
    if (!form.name.trim()) return toast("Item name is required", "error");
    setSaving(true);
    try {
      const { stock, ...details } = form;
      const saved = await api<InventoryItem>(item ? `/api/inventory/${item._id}` : "/api/inventory", {
        method: item ? "PUT" : "POST",
        body: item ? details : { ...details, stock },
      });
      toast(item ? "Item updated" : "Item added");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? "Edit item" : "New inventory item"}
      footer={
        <Button size="lg" className="w-full" loading={saving} onClick={save}>
          {item ? "Save changes" : "Add item"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Item name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Snow Foam Shampoo" autoFocus={!item} />
        </Field>
        <Field label="Category">
          <div className="grid grid-cols-3 gap-2">
            {INVENTORY_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, category: c.value })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-[11px] font-semibold leading-tight transition",
                  form.category === c.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"
                )}
              >
                <c.icon className="size-5" />
                {c.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          {item ? (
            <Field label="Current stock" hint="Use Stock in / Count to change">
              <Input value={fmtQty(item.stock, item.unit)} disabled />
            </Field>
          ) : (
            <Field label="Opening stock">
              <Input type="number" inputMode="decimal" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alert when at or below" hint={`in ${form.unit}`}>
            <Input type="number" inputMode="decimal" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="e.g. 500" />
          </Field>
          <Field label={`Cost per ${form.unit}`}>
            <MoneyInput value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Supplier">
          <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" className="min-h-20" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ───────────── Stock in / use / count ───────────── */

export type StockAction = "in" | "out" | "adjust";

export function StockSheet({
  open,
  item,
  initialAction = "in",
  onClose,
  onDone,
}: {
  open: boolean;
  item: InventoryItem | null;
  initialAction?: StockAction;
  onClose: () => void;
  onDone: (item: InventoryItem) => void;
}) {
  const toast = useToast();
  const [action, setAction] = useState<StockAction>(initialAction);
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [recordExpense, setRecordExpense] = useState(true);
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setAction(initialAction);
    setQty(initialAction === "adjust" ? String(item.stock) : "");
    setUnitCost(item.costPerUnit !== undefined ? String(item.costPerUnit) : "");
    setNote("");
  }, [open, item, initialAction]);

  if (!item) return null;

  const n = Number(qty) || 0;
  const after = action === "in" ? item.stock + n : action === "out" ? item.stock - n : n;
  const step = ["ml", "g"].includes(item.unit) ? 100 : 1;
  const bump = (d: number) => setQty(String(Math.max(0, Math.round((n + d) * 100) / 100)));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api<InventoryItem>(`/api/inventory/${item._id}/stock`, {
        method: "POST",
        body: { type: action, qty: n, unitCost, note, recordExpense: action === "in" && recordExpense, mode },
      });
      toast(action === "in" ? `Added ${fmtQty(n, item.unit)}` : action === "out" ? `Used ${fmtQty(n, item.unit)}` : "Stock count saved");
      if (stockLevel(updated) !== "ok") toast(`${updated.name} is running low`, "info");
      onDone(updated);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item.name}
      footer={
        <Button size="lg" className="w-full" variant={action === "in" ? "success" : "primary"} loading={saving} onClick={save}>
          {action === "in" ? "Add to stock" : action === "out" ? "Record usage" : "Save count"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={action}
          onChange={(a) => {
            setAction(a);
            setQty(a === "adjust" ? String(item.stock) : "");
          }}
          options={[
            { value: "in", label: "Stock in" },
            { value: "out", label: "Use" },
            { value: "adjust", label: "Count" },
          ]}
        />

        <Field label={action === "in" ? `Quantity received (${item.unit})` : action === "out" ? `Quantity used (${item.unit})` : `Counted stock (${item.unit})`}>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Decrease" onClick={() => bump(-step)} className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 active:bg-slate-100">
              <Minus className="size-5" />
            </button>
            <Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="h-12 text-center text-xl font-bold tabular-nums" autoFocus />
            <button type="button" aria-label="Increase" onClick={() => bump(step)} className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 active:bg-slate-100">
              <Plus className="size-5" />
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">
            Now <b className="tabular-nums text-slate-800">{fmtQty(item.stock, item.unit)}</b>
          </span>
          <span className="text-slate-500">
            After{" "}
            <b className={cn("tabular-nums", after < 0 ? "text-red-600" : stockLevel({ stock: after, minStock: item.minStock }) === "ok" ? "text-emerald-600" : "text-amber-600")}>
              {fmtQty(after, item.unit)}
            </b>
          </span>
        </div>

        {action === "in" && (
          <>
            <Field label={`Cost per ${item.unit}`} hint={Number(unitCost) > 0 && n > 0 ? `Total ${inr(n * Number(unitCost))}` : undefined}>
              <MoneyInput value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Optional" />
            </Field>
            {Number(unitCost) > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Add to expenses</p>
                  <p className="text-xs text-slate-500">Records this purchase under Supplies</p>
                </div>
                <Switch checked={recordExpense} onChange={setRecordExpense} label="Add to expenses" />
              </div>
            )}
            {Number(unitCost) > 0 && recordExpense && (
              <Segmented
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "cash", label: "Paid cash" },
                  { value: "online", label: "Paid online" },
                ]}
              />
            )}
          </>
        )}

        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={action === "out" ? "e.g. spilled, used for demo" : "Optional"} />
        </Field>
      </div>
    </Sheet>
  );
}
