"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, Boxes, IndianRupee, Package, Plus } from "lucide-react";
import { ItemFormSheet, LevelBadge, LowStockAlert, StockBar, StockSheet, categoryMeta, INVENTORY_CATEGORIES } from "@/app/components/inventory";
import { Button, Card, Chips, EmptyState, ErrorState, Fab, ListSkeleton, Page, SearchInput, Stat, cn } from "@/app/components/ui";
import { useApi } from "@/app/lib/api";
import { inr } from "@/app/lib/format";
import { fmtQty, stockLevel } from "@/app/lib/stock";
import type { InventoryItem } from "@/app/lib/types";

export default function InventoryClient() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}

function Inventory() {
  const params = useSearchParams();
  const { data, setData, loading, error, reload } = useApi<InventoryItem[]>("/api/inventory");

  const [filter, setFilter] = useState<string>(params.get("filter") || "all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);

  const active = useMemo(() => (data || []).filter((i) => i.isActive), [data]);
  const low = useMemo(() => active.filter((i) => stockLevel(i) !== "ok"), [active]);
  const value = active.reduce((s, i) => s + Math.max(0, i.stock) * (i.costPerUnit || 0), 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((i) => {
      if (filter === "archived") return !i.isActive;
      if (!i.isActive) return false;
      if (filter === "low" && stockLevel(i) === "ok") return false;
      if (!["all", "low"].includes(filter) && i.category !== filter) return false;
      return !q || i.name.toLowerCase().includes(q) || i.supplier?.toLowerCase().includes(q);
    });
  }, [data, filter, search]);

  const categories = INVENTORY_CATEGORIES.filter((c) => active.some((i) => i.category === c.value));
  const replace = (updated: InventoryItem) => setData((list) => list?.map((i) => (i._id === updated._id ? updated : i)));

  return (
    <Page
      title="Inventory"
      subtitle="Stock of shampoos, polishes, coatings & tools"
      back="/dashboard/more"
      actions={
        <Button size="sm" className="max-lg:hidden" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
          Add item
        </Button>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Items" value={active.length} icon={<Boxes className="size-4" />} />
            <Stat
              label="Need restock"
              value={<span className={low.length ? "text-red-600" : undefined}>{low.length}</span>}
              icon={<AlertTriangle className="size-4" />}
              tone={low.length ? "red" : "green"}
            />
            <Stat label="Stock value" value={inr(Math.round(value))} icon={<IndianRupee className="size-4" />} tone="violet" />
          </div>

          {filter !== "low" && low.length > 0 && (
            <div className="mt-3">
              <LowStockAlert items={low} />
            </div>
          )}

          <div className="mt-4 space-y-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search items or suppliers" />
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: active.length },
                { value: "low", label: "Low stock", count: low.length },
                ...categories.map((c) => ({ value: c.value, label: c.label })),
                ...((data || []).some((i) => !i.isActive) ? [{ value: "archived", label: "Archived" }] : []),
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <Card className="mt-4">
              <EmptyState
                icon={<Package />}
                title={filter === "low" ? "Everything is well stocked 🎉" : search ? "No matching items" : "No inventory yet"}
                text={
                  filter === "low" || search
                    ? undefined
                    : "Add the products you use — shampoo, polish, coatings — and get alerts before you run out."
                }
                action={
                  filter === "low" || search ? undefined : (
                    <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
                      Add first item
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {visible.map((item) => {
                const meta = categoryMeta(item.category);
                const level = stockLevel(item);
                return (
                  <Card key={item._id} className={cn("flex items-center gap-3 p-4", level === "out" && "border-red-200", !item.isActive && "opacity-60")}>
                    <Link href={`/dashboard/inventory/${item._id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
                        <meta.icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-slate-800">{item.name}</p>
                          {level !== "ok" && <LevelBadge item={item} />}
                        </div>
                        <p className="mt-0.5 flex items-baseline gap-1.5 text-sm">
                          <span className={cn("font-bold tabular-nums", level === "out" ? "text-red-600" : level === "low" ? "text-amber-600" : "text-slate-900")}>
                            {fmtQty(item.stock, item.unit)}
                          </span>
                          {item.minStock > 0 && <span className="text-xs text-slate-400">/ alert at {fmtQty(item.minStock)}</span>}
                        </p>
                        <div className="mt-2">
                          <StockBar item={item} />
                        </div>
                      </div>
                    </Link>
                    {item.isActive && (
                      <button
                        type="button"
                        aria-label={`Add stock for ${item.name}`}
                        onClick={() => setStockItem(item)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition active:scale-90"
                      >
                        <Plus className="size-5" />
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Fab label="Add item" icon={<Plus className="size-5" />} onClick={() => setFormOpen(true)} />

      <ItemFormSheet open={formOpen} item={null} onClose={() => setFormOpen(false)} onSaved={() => reload()} />
      <StockSheet open={!!stockItem} item={stockItem} initialAction="in" onClose={() => setStockItem(null)} onDone={replace} />
    </Page>
  );
}
