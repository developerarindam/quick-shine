import CashHandover from "@/app/models/CashHandover";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { can } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/**
 * { action: "approve" }          → Super Admin / Admin confirms they received the cash
 * { action: "reject", reason? }  → Super Admin / Admin declines (cash stays with the sender)
 * { action: "cancel" }           → sender withdraws a pending request
 */
export const PATCH = withAuth<Ctx>(null, async (req, { params }, user) => {
  const { id } = await params;
  const { action, reason } = await req.json();

  const request = await CashHandover.findById(id);
  if (!request) return fail("Request not found", 404);
  if (request.status !== "pending") return fail(`This request was already ${request.status}`, 409);

  const isSender = String(request.from) === user.id;

  if (action === "cancel") {
    if (!isSender) return fail("Only the sender can cancel this request", 403);
    request.status = "cancelled";
  } else if (action === "approve" || action === "reject") {
    if (!can.approveCash(user.role)) return fail("Only a Super Admin or Admin can approve handovers", 403);
    if (isSender) return fail("Someone else has to approve your own handover", 403);
    request.status = action === "approve" ? "approved" : "rejected";
    request.to = user.id;
    if (reason) request.reason = String(reason).trim();
  } else {
    return fail("Unknown action");
  }

  request.decidedAt = new Date();
  await request.save();
  return ok(request);
});
