// Per-bike money for a period (?from=&to=): what was billed, and cash / online received.
// Payments count on the day they were received, so a due cleared today shows in today's cash.
import ServiceEntry from "@/app/models/ServiceEntry";
import { ok, parseRange, withAuth } from "@/app/lib/auth";

type Row = { jobs: number; billed: number; cash: number; online: number };

export const GET = withAuth(null, async (req) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const inRange = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const jobs = await ServiceEntry.find({
    $or: [{ createdAt: { $gte: from, $lte: to } }, { "payments.at": { $gte: from, $lte: to } }],
  })
    .select("bikeId total createdAt payments paidAmount paymentType")
    .lean();

  const byBike: Record<string, Row> = {};
  const totals = { jobs: 0, billed: 0, cash: 0, online: 0, total: 0, bikes: 0 };

  for (const j of jobs) {
    const id = String(j.bikeId);
    const row = (byBike[id] ||= { jobs: 0, billed: 0, cash: 0, online: 0 });

    if (inRange(j.createdAt)) {
      row.jobs += 1;
      row.billed += j.total;
    }
    if (j.payments?.length) {
      for (const p of j.payments) {
        if (inRange(p.at)) row[p.mode as "cash" | "online"] += p.amount;
      }
    } else if (typeof j.paidAmount !== "number" && j.paymentType !== "due" && inRange(j.createdAt)) {
      // entries from before payment tracking: paid in full when billed
      row[j.paymentType === "online" ? "online" : "cash"] += j.total;
    }
  }

  for (const row of Object.values(byBike)) {
    totals.jobs += row.jobs;
    totals.billed += row.billed;
    totals.cash += row.cash;
    totals.online += row.online;
    totals.bikes += 1;
  }
  totals.total = totals.cash + totals.online;

  return ok({ totals, byBike });
});
