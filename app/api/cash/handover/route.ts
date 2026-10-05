import CashHandover from "@/app/models/CashHandover";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { cashPositions } from "@/app/lib/cash";
import { can } from "@/app/lib/roles";
import { round2 } from "@/app/lib/jobs";

// Pending requests that need my attention: to approve (Super Admin / Admin) or my own waiting ones
export const GET = withAuth(null, async (_req, _ctx, user) => {
  const filter = can.approveCash(user.role)
    ? { status: "pending", from: { $ne: user.id } }
    : { status: "pending", from: user.id };
  const pending = await CashHandover.find(filter).populate("from", "name").sort({ createdAt: 1 }).lean();
  return ok(pending);
});

// Send a handover request for cash I'm holding
export const POST = withAuth(null, async (req, _ctx, user) => {
  const { amount, note } = await req.json();
  const value = round2(Number(amount) || 0);
  if (value <= 0) return fail("Enter the amount you are handing over");

  const [me] = await cashPositions(user.id);
  if (!me || value > me.available + 0.001) {
    return fail(`You can hand over at most ₹${Math.max(0, me?.available || 0).toLocaleString("en-IN")}`);
  }

  const request = await CashHandover.create({ from: user.id, amount: value, note });
  return ok(request);
});
