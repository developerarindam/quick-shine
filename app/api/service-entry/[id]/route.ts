import ServiceEntry, { JOB_POPULATE, normalizeJob } from "@/app/models/ServiceEntry";
import "@/app/models/Bike";
import "@/app/models/Service";
import "@/app/models/User";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import { reverseJob } from "@/app/lib/inventory";
import { JOB_STATUSES, balanceOf, paidOf, round2, type JobStatus } from "@/app/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(null, async (_req, { params }) => {
  const { id } = await params;
  const entry = await ServiceEntry.findById(id).populate(JOB_POPULATE).lean();
  if (!entry) return fail("Job not found", 404);
  return ok(normalizeJob(entry));
});

/**
 * { action: "status", status }        → move job through the workflow
 * { action: "pay", amount, mode }     → record a payment against the balance
 * { action: "update", notes?, assignedTo? }
 */
export const PATCH = withAuth<Ctx>(null, async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();

  const entry = await ServiceEntry.findById(id);
  if (!entry) return fail("Job not found", 404);
  if (!entry.paymentType) entry.paymentType = "cash";

  switch (body.action) {
    case "status": {
      const status = body.status as JobStatus;
      if (!JOB_STATUSES.includes(status)) return fail("Invalid status");
      entry.status = status;
      const now = new Date();
      if ((status === "completed" || status === "delivered") && !entry.completedAt) entry.completedAt = now;
      if (status === "delivered") entry.deliveredAt = now;
      if (status !== "delivered") entry.deliveredAt = undefined;
      if (status === "pending" || status === "in_progress") entry.completedAt = undefined;
      break;
    }

    case "pay": {
      const amount = round2(Number(body.amount) || 0);
      const mode = body.mode === "online" ? "online" : "cash";
      const balance = balanceOf(entry);
      if (amount <= 0) return fail("Enter an amount");
      if (amount > balance) return fail("Amount is more than the balance due");

      entry.payments.push({ amount, mode, at: new Date(), by: user.id });
      entry.paidAmount = round2(paidOf(entry) + amount);
      entry.paymentType = balanceOf(entry) <= 0 ? mode : "due";
      break;
    }

    case "update": {
      if (body.notes !== undefined) entry.notes = String(body.notes).trim();
      if (body.assignedTo !== undefined) entry.assignedTo = body.assignedTo || undefined;
      break;
    }

    default:
      return fail("Unknown action");
  }

  await entry.save();
  const fresh = await ServiceEntry.findById(id).populate(JOB_POPULATE).lean();
  return ok(fresh && normalizeJob(fresh));
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }, user) => {
  const { id } = await params;
  const deleted = await ServiceEntry.findByIdAndDelete(id);
  if (!deleted) return fail("Job not found", 404);
  await reverseJob(id, user.id); // return consumables to stock
  return ok(null, { message: "Job deleted" });
});
