"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Minus, Pencil, Plus, RotateCcw, Sparkles, Trash2, Wrench } from "lucide-react";
import { ItemFormSheet, LevelBadge, StockBar, StockSheet, categoryMeta, type StockAction } from "@/app/components/inventory";
import { useConfirm, useToast } from "@/app/components/overlays";
import { Button, Card, EmptyState, ErrorState, IconButton, ListSkeleton, Page, SectionTitle, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { fmtWhen, inr } from "@/app/lib/format";
import { fmtQty } from "@/app/lib/stock";
import type { InventoryItem, StockMovement } from "@/app/lib/types";

type Detail = { item: InventoryItem; movements: StockMovement[]; usedBy: { _id: string; name: string; qty: number }[] };

const MOVEMENT_META: Record<StockMovement["type"], { label: string; icon: typeof Plus; tint: string }> = {
  in: { label: "Stock in", icon: ArrowDownLeft, tint: "bg-emerald-100 text-emerald-700" },
  out: { label: "Used", icon: ArrowUpRight, tint: "bg-amber-100 text-amber-700" },
  adjust: { label: "Stock count", icon: ClipboardCheck, tint: "bg-sky-100 text-sky-700" },
  job: { label: "Used in job", icon: Wrench, tint: "bg-violet-100 text-violet-700" },
  job_reversal: { label: "Job deleted — returned", icon: RotateCcw, tint: "bg-slate-100 text-slate-600" },
};

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi<Detail>(`/api/inventory/${id}`);

  const [editOpen, setEditOpen] = useState(false);
  const [stockAction, setStockAction] = useState<StockAction | null>(null);

  if (error) {
    return (
      <Page title="Item" back="/dashboard/inventory">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  }
  if (loading && !data) {
    return (
      <Page title="Item" back="/dashboard/inventory">
        <ListSkeleton rows={4} />
      </Page>
    );
  }
  if (!data) return null;

  const { item, movements, usedBy } = data;
  const meta = categoryMeta(item.category);

  const remove = async () => {
    const ok = await confirm({ title: `Delete ${item.name}?`, message: "Items with stock history are archived instead.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/inventory/${id}`, { method: "DELETE" });
      toast("Item removed");
      router.replace("/dashboard/inventory");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const restore = async () => {
    try {
      await api(`/api/inventory/${id}`, { method: "PUT", body: { isActive: true } });
      toast("Item restored");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Page
      title={item.name}
      subtitle={meta.label}
      back="/dashboard/inventory"
      actions={
        <>
          <IconButton label="Edit item" onClick={() => setEditOpen(true)}>
            <Pencil className="size-5" />
          </IconButton>
          <IconButton label="Delete item" onClick={remove} className="text-red-500 hover:bg-red-50">
            <Trash2 className="size-5" />
          </IconButton>
        </>
      }
    >
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">In stock</p>
            <p className="text-4xl font-bold tracking-tight tabular-nums text-slate-900">
              {fmtQty(item.stock)} <span className="text-xl font-semibold text-slate-400">{item.unit}</span>
            </p>
          </div>
          <span className={cn("flex size-12 items-center justify-center rounded-2xl", meta.tint)}>
            <meta.icon className="size-6" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LevelBadge item={item} />
          {!item.isActive && <span className="text-xs font-semibold text-slate-500">Archived</span>}
        </div>
        <div className="mt-4">
          <StockBar item={item} />
          <p className="mt-1.5 text-xs text-slate-500">
            {item.minStock > 0 ? `Alert at ${fmtQty(item.minStock, item.unit)}` : "No alert level set — edit to add one"}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50 py-3 text-center text-sm">
          <div>
            <dt className="text-xs text-slate-500">Cost / {item.unit}</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{item.costPerUnit !== undefined ? inr(item.costPerUnit) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Stock value</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{item.costPerUnit ? inr(Math.round(Math.max(0, item.stock) * item.costPerUnit)) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Supplier</dt>
            <dd className="truncate px-1 font-semibold text-slate-800">{item.supplier || "—"}</dd>
          </div>
        </dl>

        {item.isActive ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="success" icon={<Plus className="size-4" />} onClick={() => setStockAction("in")}>
              Stock in
            </Button>
            <Button variant="outline" icon={<Minus className="size-4" />} onClick={() => setStockAction("out")}>
              Use
            </Button>
            <Button variant="outline" icon={<ClipboardCheck className="size-4" />} onClick={() => setStockAction("adjust")}>
              Count
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-4 w-full" icon={<RotateCcw className="size-4" />} onClick={restore}>
            Restore item
          </Button>
        )}
        {item.notes && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{item.notes}</p>}
      </Card>

      <SectionTitle>Auto-used by services</SectionTitle>
      {usedBy.length === 0 ? (
        <Card className="p-4 text-sm text-slate-500">
          Not linked to any service. Link it under{" "}
          <Link href="/dashboard/services" className="font-semibold text-brand-600">
            Services & pricing
          </Link>{" "}
          so stock is deducted automatically when jobs are saved.
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {usedBy.map((s) => (
            <div key={s._id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <Sparkles className="size-4 text-brand-500" /> {s.name}
              </span>
              <span className="tabular-nums text-slate-500">{fmtQty(s.qty, item.unit)} per job</span>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle>Stock history</SectionTitle>
      {movements.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardCheck />} title="No stock movements yet" />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {movements.map((m) => {
            const mm = MOVEMENT_META[m.type];
            return (
              <div key={m._id} className="flex items-center gap-3 px-4 py-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", mm.tint)}>
                  <mm.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {mm.label}
                    {m.job && (
                      <Link href={`/dashboard/service-entry/${m.job._id}`} className="ml-1 text-brand-600">
                        #{m.job.jobNo || m.job._id.slice(-5)}
                      </Link>
                    )}
                    {m.note && <span className="font-normal text-slate-500"> · {m.note}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {fmtWhen(m.createdAt)}
                    {m.by?.name ? ` · ${m.by.name}` : ""}
                    {m.unitCost ? ` · ${inr(m.unitCost)}/${item.unit}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-sm font-bold tabular-nums", m.qty >= 0 ? "text-emerald-600" : "text-slate-800")}>
                    {m.qty >= 0 ? "+" : "−"}
                    {fmtQty(Math.abs(m.qty))}
                  </p>
                  {m.balanceAfter !== undefined && <p className="text-xs tabular-nums text-slate-400">= {fmtQty(m.balanceAfter)}</p>}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <ItemFormSheet open={editOpen} item={item} onClose={() => setEditOpen(false)} onSaved={() => reload()} />
      <StockSheet
        open={!!stockAction}
        item={item}
        initialAction={stockAction || "in"}
        onClose={() => setStockAction(null)}
        onDone={() => reload()}
      />
    </Page>
  );
}
