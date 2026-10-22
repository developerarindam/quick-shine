import Expense, { EXPENSE_CATEGORIES } from "@/app/models/Expense";
import "@/app/models/User";
import { fail, ok, parseRange, withAuth } from "@/app/lib/auth";
import { expensePayer } from "@/app/lib/jobEntry";
import { allowed, can } from "@/app/lib/roles";

// Super Admin / Admin see every expense; staff see the ones they recorded or paid
export const GET = withAuth(null, async (req, _ctx, user) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const scope = can.manageStudio(user.role) ? {} : { $or: [{ createdBy: user.id }, { paidBy: user.id }] };
  const expenses = await Expense.find({ date: { $gte: from, $lte: to }, ...scope })
    .populate("createdBy", "name")
    .populate("paidBy", "name")
    .sort({ date: -1, createdAt: -1 })
    .lean();
  return ok(expenses);
});

/**
 * Anyone can record an expense.
 * cash   → comes out of the payer's cash in hand (staff: always their own)
 * online → always paid from the online account (Chandan Manna)
 */
export const POST = withAuth(null, async (req, _ctx, user) => {
  const { title, amount, category, mode, date, note, paidBy } = await req.json();
  const manager = can.manageStudio(user.role);
  if (!allowed(user, "recordExpenses")) return fail("You don't have permission to record expenses", 403);

  if (!title || !String(title).trim()) return fail("What was this expense for?");
  if (!(Number(amount) > 0)) return fail("Enter an amount");
  if (category && !EXPENSE_CATEGORIES.includes(category)) return fail("Invalid category");
  if (!manager && mode === "online") {
    return fail("Online expenses are paid from Chandan Manna's account — ask an Admin to record them");
  }
  if (!manager && category === "salary") return fail("Salary is paid from Attendance → Payroll");

  // Staff record what they spent recently; only Super Admin / Admin enter older or future-dated expenses
  const when = date ? new Date(date) : new Date();
  if (Number.isNaN(when.getTime())) return fail("Invalid date");
  if (!manager) {
    const days = (Date.now() - when.getTime()) / 86_400_000;
    if (days < -0.1 || days > 3) return fail("You can only record expenses from the last 3 days — ask an Admin for older ones");
  }

  const payMode = mode === "online" ? "online" : "cash";
  const expense = await Expense.create({
    title,
    amount: Number(amount),
    category: category || "other",
    mode: payMode,
    date: when,
    note,
    createdBy: user.id,
    paidBy: await expensePayer(payMode, paidBy, user),
  });

  return ok(expense);
});
