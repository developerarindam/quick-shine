// Cash custody overview: my cash in hand, the team's (for Super Admin / Admin),
// handover requests, and who collected what in the selected period.
import CashHandover from "@/app/models/CashHandover";
import User from "@/app/models/User";
import { ok, parseRange, withAuth } from "@/app/lib/auth";
import { cashCollectedBetween, cashPositions } from "@/app/lib/cash";
import { can } from "@/app/lib/roles";

export const GET = withAuth(null, async (req, _ctx, user) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const manager = can.approveCash(user.role);

  const scope = manager ? {} : { from: user.id };
  const [positions, collected, requests, users] = await Promise.all([
    cashPositions(manager ? undefined : user.id),
    cashCollectedBetween(from, to),
    CashHandover.find({
      ...scope,
      $or: [{ status: "pending" }, { createdAt: { $gte: from, $lte: to } }, { decidedAt: { $gte: from, $lte: to } }],
    })
      .populate("from", "name role")
      .populate("to", "name")
      .sort({ status: 1, createdAt: -1 })
      .lean(),
    User.find().select("name").lean(),
  ]);

  const names = new Map(users.map((u) => [String(u._id), u.name]));
  const period = [...collected.entries()]
    .filter(([id]) => manager || id === user.id)
    .map(([id, v]) => ({ userId: id, name: names.get(id) || "Former member", ...v }))
    .sort((a, b) => b.cash - a.cash);

  return ok({
    me: positions.find((p) => p.userId === user.id) || null,
    team: manager ? positions : [],
    period,
    // newest first, pending on top
    requests: requests.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")),
  });
});
