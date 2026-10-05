// Server-side cash custody: who is holding how much cash right now.
//
// in hand = cash collected from customers (payments recorded with them as collector)
//         + handovers they approved (cash received)
//         − handovers they gave that were approved
//         − expenses they recorded as paid in cash
// available = in hand − handovers still waiting for approval
import mongoose from "mongoose";
import ServiceEntry from "@/app/models/ServiceEntry";
import CashHandover from "@/app/models/CashHandover";
import Expense from "@/app/models/Expense";
import User from "@/app/models/User";
import { round2 } from "@/app/lib/jobs";

export type CashPosition = {
  userId: string;
  name: string;
  role: string;
  collected: number;
  received: number;
  handedOver: number;
  spent: number;
  pending: number;
  inHand: number;
  available: number;
};

const sumBy = (rows: { _id: unknown; total: number }[]) => new Map(rows.map((r) => [String(r._id), r.total]));

export async function cashPositions(onlyUserId?: string): Promise<CashPosition[]> {
  const uid = onlyUserId ? new mongoose.Types.ObjectId(onlyUserId) : null;

  const [collected, received, given, pending, spent, users] = await Promise.all([
    ServiceEntry.aggregate([
      { $unwind: "$payments" },
      { $match: { "payments.mode": "cash", "payments.by": uid ? uid : { $exists: true, $ne: null } } },
      { $group: { _id: "$payments.by", total: { $sum: "$payments.amount" } } },
    ]),
    CashHandover.aggregate([
      { $match: { status: "approved", ...(uid ? { to: uid } : {}) } },
      { $group: { _id: "$to", total: { $sum: "$amount" } } },
    ]),
    CashHandover.aggregate([
      { $match: { status: "approved", ...(uid ? { from: uid } : {}) } },
      { $group: { _id: "$from", total: { $sum: "$amount" } } },
    ]),
    CashHandover.aggregate([
      { $match: { status: "pending", ...(uid ? { from: uid } : {}) } },
      { $group: { _id: "$from", total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      { $match: { mode: "cash", createdBy: uid ? uid : { $exists: true, $ne: null } } },
      { $group: { _id: "$createdBy", total: { $sum: "$amount" } } },
    ]),
    User.find(uid ? { _id: uid } : {}).select("name role status").lean(),
  ]);

  const c = sumBy(collected), r = sumBy(received), g = sumBy(given), p = sumBy(pending), s = sumBy(spent);

  return users
    .filter((u) => {
      // former members still show while they hold (or owe) cash
      const id = String(u._id);
      const touched = (c.get(id) || 0) + (r.get(id) || 0) + (g.get(id) || 0) + (s.get(id) || 0) !== 0;
      return u.status === "Active" || touched;
    })
    .map((u): CashPosition => {
      const id = String(u._id);
      const inHand = round2((c.get(id) || 0) + (r.get(id) || 0) - (g.get(id) || 0) - (s.get(id) || 0));
      const pend = round2(p.get(id) || 0);
      return {
        userId: id,
        name: u.name,
        role: u.role,
        collected: round2(c.get(id) || 0),
        received: round2(r.get(id) || 0),
        handedOver: round2(g.get(id) || 0),
        spent: round2(s.get(id) || 0),
        pending: pend,
        inHand,
        available: round2(Math.max(0, inHand - pend)),
      };
    })
    .sort((a, b) => b.inHand - a.inHand);
}

/** Cash each person collected from customers in [from, to], for the end-of-day view. */
export async function cashCollectedBetween(from: Date, to: Date) {
  const rows = await ServiceEntry.aggregate([
    { $match: { "payments.at": { $gte: from, $lte: to } } },
    { $unwind: "$payments" },
    { $match: { "payments.at": { $gte: from, $lte: to }, "payments.by": { $ne: null } } },
    {
      $group: {
        _id: { by: "$payments.by", mode: "$payments.mode" },
        total: { $sum: "$payments.amount" },
        count: { $sum: 1 },
      },
    },
  ]);
  const byUser = new Map<string, { cash: number; online: number; count: number }>();
  for (const r of rows) {
    const id = String(r._id.by);
    const row = byUser.get(id) || { cash: 0, online: 0, count: 0 };
    row[r._id.mode as "cash" | "online"] += r.total;
    row.count += r.count;
    byUser.set(id, row);
  }
  return byUser;
}
