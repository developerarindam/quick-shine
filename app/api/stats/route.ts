// Dashboard numbers for a date range (default today). Money fields only for owners/managers.
import ServiceEntry from "@/app/models/ServiceEntry";
import Expense from "@/app/models/Expense";
import { ok, parseRange, withAuth } from "@/app/lib/auth";
import { can } from "@/app/lib/roles";
import { ACTIVE_STATUSES } from "@/app/lib/jobs";
import { collectionsBetween, outstandingDues, sumByMode } from "@/app/lib/finance";

export const GET = withAuth(null, async (req, _ctx, user) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);

  const [jobs, statusAgg] = await Promise.all([
    ServiceEntry.find({ createdAt: { $gte: from, $lte: to } }).select("total status").lean(),
    ServiceEntry.aggregate([
      { $match: { status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(ACTIVE_STATUSES.map((s) => [s, 0]));
  for (const s of statusAgg) statusCounts[s._id] = s.count;

  const base = {
    jobs: jobs.length,
    delivered: jobs.filter((j) => (j.status ?? "delivered") === "delivered").length,
    statusCounts,
  };

  if (!can.manageStudio(user.role)) return ok(base);

  const [collections, expenseAgg, dues] = await Promise.all([
    collectionsBetween(from, to),
    Expense.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    outstandingDues(),
  ]);

  const billed = jobs.reduce((s, j) => s + j.total, 0);
  const collected = sumByMode(collections);
  const expenses = expenseAgg[0]?.total || 0;

  return ok({
    ...base,
    billed,
    collected,
    expenses,
    net: collected.total - expenses,
    dues,
  });
});
