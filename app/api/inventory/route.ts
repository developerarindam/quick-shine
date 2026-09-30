import InventoryItem, { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/app/models/InventoryItem";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { applyStockChange, lowStockItems } from "@/app/lib/inventory";
import { MANAGERS } from "@/app/lib/roles";

/**
 * ?low=1  → only items that need restocking (for alerts)
 * ?lite=1 → id/name/unit of active items (for pickers)
 * default → every item, active first
 */
export const GET = withAuth(MANAGERS, async (req) => {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("low")) return ok(await lowStockItems());

  if (searchParams.get("lite")) {
    const items = await InventoryItem.find({ isActive: true }).select("name unit stock").sort({ name: 1 }).lean();
    return ok(items);
  }

  const items = await InventoryItem.find().sort({ isActive: -1, name: 1 }).lean();
  return ok(items);
});

export const POST = withAuth(MANAGERS, async (req, _ctx, user) => {
  const { name, category, unit, stock, minStock, costPerUnit, supplier, notes } = await req.json();

  if (!name || !String(name).trim()) return fail("Item name is required");
  if (category && !INVENTORY_CATEGORIES.includes(category)) return fail("Invalid category");
  if (unit && !INVENTORY_UNITS.includes(unit)) return fail("Invalid unit");

  const item = await InventoryItem.create({
    name,
    category: category || "other",
    unit: unit || "pcs",
    stock: 0,
    minStock: Math.max(0, Number(minStock) || 0),
    costPerUnit: costPerUnit === "" || costPerUnit === undefined ? undefined : Number(costPerUnit),
    supplier,
    notes,
  });

  const opening = Number(stock) || 0;
  if (opening > 0) {
    await applyStockChange(String(item._id), opening, { type: "adjust", note: "Opening stock", by: user.id });
  }

  return ok(await InventoryItem.findById(item._id).lean());
});
