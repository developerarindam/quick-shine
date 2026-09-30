import Expense, { EXPENSE_CATEGORIES } from "@/app/models/Expense";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withAuth<Ctx>(MANAGERS, async (req, { params }) => {
  const { id } = await params;
  const { title, amount, category, mode, date, note } = await req.json();

  const expense = await Expense.findById(id);
  if (!expense) return fail("Expense not found", 404);

  if (title !== undefined) expense.title = title;
  if (amount !== undefined) {
    if (!(Number(amount) > 0)) return fail("Enter an amount");
    expense.amount = Number(amount);
  }
  if (category !== undefined) {
    if (!EXPENSE_CATEGORIES.includes(category)) return fail("Invalid category");
    expense.category = category;
  }
  if (mode !== undefined) expense.mode = mode === "online" ? "online" : "cash";
  if (date) expense.date = new Date(date);
  if (note !== undefined) expense.note = note;

  await expense.save();
  return ok(expense);
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }) => {
  const { id } = await params;
  const deleted = await Expense.findByIdAndDelete(id);
  if (!deleted) return fail("Expense not found", 404);
  return ok(null, { message: "Expense deleted" });
});
