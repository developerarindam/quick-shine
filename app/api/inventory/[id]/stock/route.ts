import InventoryItem from "@/app/models/InventoryItem";
import Expense from "@/app/models/Expense";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { applyStockChange } from "@/app/lib/inventory";
import { MANAGERS } from "@/app/lib/roles";
import { round2 } from "@/app/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * { type: "in",     qty, unitCost?, note?, recordExpense?, mode? } → restock (optionally logs a Supplies expense)
 * { type: "out",    qty, note? }                                  → manual use / wastage
 * { type: "adjust", qty, note? }                                  → set the counted stock to exactly qty
 */
export const POST = withAuth<Ctx>(MANAGERS, async (req, { params }, user) => {
  const { id } = await params;
  const { type, qty, unitCost, note, recordExpense, mode } = await req.json();

  const item = await InventoryItem.findById(id).lean();
  if (!item) return fail("Item not found", 404);

  const amount = round2(Number(qty));
  if (!Number.isFinite(amount) || amount < 0) return fail("Enter a valid quantity");

  let delta: number;
  switch (type) {
    case "in":
      if (amount <= 0) return fail("Enter how much came in");
      delta = amount;
      break;
    case "out":
      if (amount <= 0) return fail("Enter how much was used");
      delta = -amount;
      break;
    case "adjust":
      delta = round2(amount - item.stock);
      if (delta === 0) return fail("Stock is already at that count");
      break;
    default:
      return fail("Unknown stock action");
  }

  const cost = unitCost === "" || unitCost === undefined ? undefined : Number(unitCost);
  const updated = await applyStockChange(id, delta, {
    type,
    note: note?.trim() || undefined,
    unitCost: type === "in" ? cost : undefined,
    by: user.id,
  });

  if (type === "in" && recordExpense && cost && cost > 0) {
    await Expense.create({
      title: `${item.name} × ${amount} ${item.unit}`,
      amount: round2(amount * cost),
      category: "supplies",
      mode: mode === "online" ? "online" : "cash",
      date: new Date(),
      note: note?.trim() || "Inventory restock",
      createdBy: user.id,
    });
  }

  return ok(updated);
});
