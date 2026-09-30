// Server-side money calculations shared by the dashboard and reports.
import ServiceEntry from "@/app/models/ServiceEntry";
import { balanceOf } from "@/app/lib/jobs";

type Collection = { at: Date; amount: number; mode: "cash" | "online" };

/**
 * Every payment received in [from, to] — including dues collected today on older jobs.
 * Entries created before payment tracking count as paid in full on their creation date.
 */
export async function collectionsBetween(from: Date, to: Date): Promise<Collection[]> {
  const [withPayments, legacy] = await Promise.all([
    ServiceEntry.find({ "payments.at": { $gte: from, $lte: to } }).select("payments").lean(),
    ServiceEntry.find({
      createdAt: { $gte: from, $lte: to },
      paidAmount: { $exists: false },
      paymentType: { $ne: "due" },
    })
      .select("total paymentType createdAt")
      .lean(),
  ]);

  const out: Collection[] = [];
  for (const e of withPayments) {
    for (const p of e.payments || []) {
      const at = new Date(p.at);
      if (at >= from && at <= to) out.push({ at, amount: p.amount, mode: p.mode });
    }
  }
  for (const e of legacy) {
    out.push({ at: new Date(e.createdAt), amount: e.total, mode: e.paymentType === "online" ? "online" : "cash" });
  }
  return out;
}

export function sumByMode(list: Collection[]) {
  const cash = list.filter((c) => c.mode === "cash").reduce((s, c) => s + c.amount, 0);
  const online = list.filter((c) => c.mode === "online").reduce((s, c) => s + c.amount, 0);
  return { cash, online, total: cash + online };
}

/** Money still to be collected across all jobs */
export async function outstandingDues() {
  const dueJobs = await ServiceEntry.find({ paymentType: "due" }).select("total paidAmount paymentType").lean();
  return {
    count: dueJobs.length,
    amount: dueJobs.reduce((s, j) => s + balanceOf(j), 0),
  };
}
