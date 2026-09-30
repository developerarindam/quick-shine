// Server-side stock operations. Every change goes through applyStockChange so the
// item's stock and its movement log never drift apart.
import InventoryItem from "@/app/models/InventoryItem";
import StockMovement from "@/app/models/StockMovement";
import Service from "@/app/models/Service";
import { LOW_STOCK_FILTER, stockLevel } from "@/app/lib/stock";

type ChangeOpts = {
  type: "in" | "out" | "adjust" | "job" | "job_reversal";
  note?: string;
  unitCost?: number;
  job?: string;
  by?: string;
};

/** Atomically adds `qty` (may be negative) to an item's stock and logs the movement. */
export async function applyStockChange(itemId: string, qty: number, opts: ChangeOpts) {
  const update: Record<string, unknown> = { $inc: { stock: qty } };
  if (opts.type === "in" && opts.unitCost && opts.unitCost > 0) update.$set = { costPerUnit: opts.unitCost };

  const item = await InventoryItem.findByIdAndUpdate(itemId, update, { returnDocument: "after" });
  if (!item) return null;

  await StockMovement.create({
    item: itemId,
    type: opts.type,
    qty,
    balanceAfter: item.stock,
    unitCost: opts.unitCost,
    note: opts.note,
    job: opts.job,
    by: opts.by,
  });
  return item;
}

/**
 * Deducts the inventory used by a job's services (per Service.consumes).
 * Returns items that are now low or out of stock, so the UI can warn right away.
 */
export async function consumeForJob(jobId: string, serviceIds: string[], by: string) {
  const services = await Service.find({ _id: { $in: serviceIds } }).select("consumes").lean();

  const totals = new Map<string, number>();
  for (const sid of serviceIds) {
    const svc = services.find((s) => String(s._id) === String(sid));
    for (const c of svc?.consumes || []) {
      totals.set(String(c.item), (totals.get(String(c.item)) || 0) + c.qty);
    }
  }

  const low: { name: string; stock: number; unit: string }[] = [];
  for (const [itemId, qty] of totals) {
    if (qty <= 0) continue;
    const item = await applyStockChange(itemId, -qty, { type: "job", job: jobId, by });
    if (item && item.isActive && stockLevel(item) !== "ok") low.push({ name: item.name, stock: item.stock, unit: item.unit });
  }
  return low;
}

/** Puts back everything a deleted job had used. */
export async function reverseJob(jobId: string, by: string) {
  const used = await StockMovement.find({ job: jobId, type: "job" }).lean();
  for (const m of used) {
    await applyStockChange(String(m.item), -m.qty, { type: "job_reversal", job: jobId, by });
  }
}

export async function lowStockItems() {
  return InventoryItem.find(LOW_STOCK_FILTER).select("name stock minStock unit").sort({ stock: 1 }).lean();
}
