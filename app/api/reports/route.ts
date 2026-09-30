// Business report for a date range — owners/managers only.
import ServiceEntry from "@/app/models/ServiceEntry";
import Expense from "@/app/models/Expense";
import "@/app/models/Service";
import "@/app/models/User";
import { ok, parseRange, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import { collectionsBetween, outstandingDues, sumByMode } from "@/app/lib/finance";

type Bucket = { key: string; billed: number; collected: number; expenses: number; jobs: number };

export const GET = withAuth(MANAGERS, async (req) => {
  const { searchParams } = new URL(req.url);
  const { from, to } = parseRange(searchParams);
  // Client's getTimezoneOffset(), so days are grouped in the studio's local time
  const tzOffset = Number(searchParams.get("tz")) || 0;

  const [jobs, expenses, collections, dues] = await Promise.all([
    ServiceEntry.find({ createdAt: { $gte: from, $lte: to } })
      .populate("services.serviceId", "name")
      .populate("assignedTo", "name")
      .select("services subtotal total createdAt assignedTo")
      .lean(),
    Expense.find({ date: { $gte: from, $lte: to } }).select("amount category date").lean(),
    collectionsBetween(from, to),
    outstandingDues(),
  ]);

  // Group by day, or by month for long ranges
  const days = (to.getTime() - from.getTime()) / 86400000;
  const keyLength = days > 62 ? 7 : 10;
  const keyOf = (d: Date | string) =>
    new Date(new Date(d).getTime() - tzOffset * 60000).toISOString().slice(0, keyLength);

  const buckets = new Map<string, Bucket>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = keyOf(cursor);
    if (!buckets.has(key)) buckets.set(key, { key, billed: 0, collected: 0, expenses: 0, jobs: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const bucket = (d: Date | string) => {
    const key = keyOf(d);
    if (!buckets.has(key)) buckets.set(key, { key, billed: 0, collected: 0, expenses: 0, jobs: 0 });
    return buckets.get(key)!;
  };

  const services = new Map<string, { name: string; count: number; revenue: number }>();
  const staff = new Map<string, { name: string; jobs: number; billed: number }>();
  let billed = 0;
  let discounts = 0;

  for (const j of jobs) {
    billed += j.total;
    discounts += Math.max(0, j.subtotal - j.total);
    const b = bucket(j.createdAt);
    b.billed += j.total;
    b.jobs += 1;

    for (const s of j.services) {
      const name = s.name || s.serviceId?.name || "Removed service";
      const row = services.get(name) || { name, count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += s.price;
      services.set(name, row);
    }

    const staffName = j.assignedTo?.name || "Unassigned";
    const st = staff.get(staffName) || { name: staffName, jobs: 0, billed: 0 };
    st.jobs += 1;
    st.billed += j.total;
    staff.set(staffName, st);
  }

  for (const c of collections) bucket(c.at).collected += c.amount;

  const byCategory = new Map<string, number>();
  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += e.amount;
    bucket(e.date).expenses += e.amount;
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
  }

  const collected = sumByMode(collections);

  return ok({
    summary: {
      jobs: jobs.length,
      billed,
      discounts,
      avgTicket: jobs.length ? billed / jobs.length : 0,
      collected,
      expenses: expenseTotal,
      profit: billed - expenseTotal,
      cashflow: collected.total - expenseTotal,
      dues,
    },
    series: { unit: keyLength === 7 ? "month" : "day", points: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)) },
    services: [...services.values()].sort((a, b) => b.revenue - a.revenue),
    staff: [...staff.values()].sort((a, b) => b.billed - a.billed),
    expenseCategories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  });
});
