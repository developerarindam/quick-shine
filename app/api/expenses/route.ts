import Expense, { EXPENSE_CATEGORIES } from "@/app/models/Expense";
import "@/app/models/User";
import { fail, ok, parseRange, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

export const GET = withAuth(MANAGERS, async (req) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const expenses = await Expense.find({ date: { $gte: from, $lte: to } })
    .populate("createdBy", "name")
    .sort({ date: -1, createdAt: -1 })
    .lean();
  return ok(expenses);
});

export const POST = withAuth(MANAGERS, async (req, _ctx, user) => {
  const { title, amount, category, mode, date, note } = await req.json();

  if (!title || !String(title).trim()) return fail("What was this expense for?");
  if (!(Number(amount) > 0)) return fail("Enter an amount");
  if (category && !EXPENSE_CATEGORIES.includes(category)) return fail("Invalid category");

  const expense = await Expense.create({
    title,
    amount: Number(amount),
    category: category || "other",
    mode: mode === "online" ? "online" : "cash",
    date: date ? new Date(date) : new Date(),
    note,
    createdBy: user.id,
  });

  return ok(expense);
});
