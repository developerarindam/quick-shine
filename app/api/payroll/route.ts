// Payroll — Super Admin only. Earned (from attendance × pay rate) vs paid (salary expenses).
import Attendance from "@/app/models/Attendance";
import Expense from "@/app/models/Expense";
import User from "@/app/models/User";
import { clearSessionCache, fail, ok, parseRange, withAuth } from "@/app/lib/auth";
import { dayKey } from "@/app/lib/attendance";
import { earningsFor, type PayType } from "@/app/lib/attendanceShared";
import { entryDate } from "@/app/lib/jobEntry";
import { round2 } from "@/app/lib/jobs";

const PAY_TYPES: PayType[] = ["daily", "hourly", "monthly"];

export const GET = withAuth(["ADMIN"], async (req) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const [users, shifts, payments] = await Promise.all([
    User.find({ $or: [{ status: "Active" }, { "pay.rate": { $gt: 0 } }] }).select("name role status pay").sort({ name: 1 }).lean(),
    Attendance.find({ date: { $gte: dayKey(from), $lte: dayKey(to) } }).lean(),
    Expense.find({ employee: { $ne: null }, date: { $gte: from, $lte: to } }).sort({ date: -1 }).lean(),
  ]);

  const rows = users.map((u) => {
    const id = String(u._id);
    const mine = shifts.filter((s) => String(s.user) === id);
    const paidList = payments.filter((p) => String(p.employee) === id);
    const e = earningsFor(mine, u.pay);
    const paid = round2(paidList.reduce((s, p) => s + p.amount, 0));
    return {
      user: { _id: id, name: u.name, role: u.role, status: u.status },
      pay: u.pay?.type ? u.pay : null,
      ...e,
      hours: round2(e.hours),
      paid,
      balance: round2(e.earned - paid),
      payments: paidList.map((p) => ({ _id: p._id, amount: p.amount, mode: p.mode, date: p.date, note: p.note })),
    };
  });

  // people with no attendance, pay or payments in the period are noise
  const visible = rows.filter((r) => r.user.status === "Active" || r.days || r.paid);
  const totals = visible.reduce(
    (t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, balance: t.balance + r.balance }),
    { earned: 0, paid: 0, balance: 0 }
  );
  return ok({ rows: visible, totals });
});

/** Set someone's pay: { userId, type, rate } */
export const PUT = withAuth(["ADMIN"], async (req) => {
  const { userId, type, rate } = await req.json();
  if (!PAY_TYPES.includes(type)) return fail("Choose per day, per hour or monthly");
  const value = Number(rate);
  if (!(value >= 0)) return fail("Enter a valid rate");
  const user = await User.findById(userId);
  if (!user) return fail("Employee not found", 404);
  user.pay = { type, rate: value };
  await user.save();
  clearSessionCache();
  return ok({ pay: user.pay });
});

/** Pay salary / wages: { userId, amount, mode, note?, date? } — recorded as a Salary expense */
export const POST = withAuth(["ADMIN"], async (req, _ctx, admin) => {
  const { userId, amount, mode, note, date } = await req.json();
  const value = round2(Number(amount) || 0);
  if (value <= 0) return fail("Enter the amount paid");
  const emp = await User.findById(userId).select("name").lean();
  if (!emp) return fail("Employee not found", 404);

  const expense = await Expense.create({
    title: `Salary — ${emp.name}`,
    amount: value,
    category: "salary",
    mode: mode === "online" ? "online" : "cash",
    date: entryDate(date, admin),
    note: note?.trim() || undefined,
    employee: userId,
    createdBy: admin.id,
  });
  return ok(expense);
});
