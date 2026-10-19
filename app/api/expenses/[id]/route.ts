import Expense, { EXPENSE_CATEGORIES } from "@/app/models/Expense";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { expensePayer } from "@/app/lib/jobEntry";

type Ctx = { params: Promise<{ id: string }> };

// Only the Super Admin edits or deletes expenses once they are recorded
export const PUT = withAuth<Ctx>(["ADMIN"], async (req, { params }, user) => {
  const { id } = await params;
  const { title, amount, category, mode, date, note, paidBy } = await req.json();

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
  // Who paid (and cash ↔ online, which changes who paid) is the Super Admin's call only
  const payerChange =
    (mode !== undefined && (mode === "online" ? "online" : "cash") !== expense.mode) ||
    (paidBy !== undefined && String(paidBy) !== String(expense.paidBy ?? expense.createdBy));
  if (payerChange && user.role !== "ADMIN") return fail("Only the Super Admin can change who paid this expense", 403);

  if (mode !== undefined) expense.mode = mode === "online" ? "online" : "cash";
  if (payerChange) {
    expense.paidBy = await expensePayer(expense.mode, paidBy ?? expense.paidBy ?? expense.createdBy, user);
  }
  if (date) expense.date = new Date(date);
  if (note !== undefined) expense.note = note;

  await expense.save();
  return ok(expense);
});

export const DELETE = withAuth<Ctx>(["ADMIN"], async (_req, { params }) => {
  const { id } = await params;
  const deleted = await Expense.findByIdAndDelete(id);
  if (!deleted) return fail("Expense not found", 404);
  return ok(null, { message: "Expense deleted" });
});
