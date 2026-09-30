import InventoryItem, { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/app/models/InventoryItem";
import StockMovement from "@/app/models/StockMovement";
import Service from "@/app/models/Service";
import "@/app/models/ServiceEntry";
import "@/app/models/User";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

// Item with its latest stock movements and the services that use it
export const GET = withAuth<Ctx>(MANAGERS, async (_req, { params }) => {
  const { id } = await params;
  const item = await InventoryItem.findById(id).lean();
  if (!item) return fail("Item not found", 404);

  const [movements, usedBy] = await Promise.all([
    StockMovement.find({ item: id })
      .populate("by", "name")
      .populate("job", "jobNo")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    Service.find({ "consumes.item": id }).select("name consumes").lean(),
  ]);

  return ok({
    item,
    movements,
    usedBy: usedBy.map((s) => ({
      _id: s._id,
      name: s.name,
      qty: s.consumes.find((c: { item: unknown }) => String(c.item) === id)?.qty || 0,
    })),
  });
});

// Edits details only — stock changes go through /stock so they are logged
export const PUT = withAuth<Ctx>(MANAGERS, async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();

  const item = await InventoryItem.findById(id);
  if (!item) return fail("Item not found", 404);

  if (body.name !== undefined) {
    if (!String(body.name).trim()) return fail("Item name is required");
    item.name = body.name;
  }
  if (body.category !== undefined) {
    if (!INVENTORY_CATEGORIES.includes(body.category)) return fail("Invalid category");
    item.category = body.category;
  }
  if (body.unit !== undefined) {
    if (!INVENTORY_UNITS.includes(body.unit)) return fail("Invalid unit");
    item.unit = body.unit;
  }
  if (body.minStock !== undefined) item.minStock = Math.max(0, Number(body.minStock) || 0);
  if (body.costPerUnit !== undefined) item.costPerUnit = body.costPerUnit === "" ? undefined : Number(body.costPerUnit);
  if (body.supplier !== undefined) item.supplier = body.supplier;
  if (body.notes !== undefined) item.notes = body.notes;
  if (body.isActive !== undefined) item.isActive = !!body.isActive;

  await item.save();
  return ok(item);
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }) => {
  const { id } = await params;

  // Items with real history are archived so past records stay readable
  const history = await StockMovement.countDocuments({ item: id, note: { $ne: "Opening stock" } });
  if (history > 0) {
    await InventoryItem.findByIdAndUpdate(id, { isActive: false });
    return ok(null, { message: "Item has stock history, so it was archived instead" });
  }

  const deleted = await InventoryItem.findByIdAndDelete(id);
  if (!deleted) return fail("Item not found", 404);
  await Promise.all([
    StockMovement.deleteMany({ item: id }),
    Service.updateMany({ "consumes.item": id }, { $pull: { consumes: { item: id } } }),
  ]);
  return ok(null, { message: "Item deleted" });
});
