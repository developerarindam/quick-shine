import ServiceEntry, { hydrateJobs } from "@/app/models/ServiceEntry";
import Service from "@/app/models/Service";
import User from "@/app/models/User";
import "@/app/models/Bike";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS, can } from "@/app/lib/roles";
import { consumeForJob, reverseJob } from "@/app/lib/inventory";
import { InputError, entryDate, receiverFor } from "@/app/lib/jobEntry";
import { JOB_STATUSES, balanceOf, calcTotals, paidOf, round2, type JobStatus } from "@/app/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };

async function loadJob(id: string) {
  const entry = await ServiceEntry.findById(id).lean();
  return entry ? (await hydrateJobs([entry], { bikes: true }))[0] : null;
}

export const GET = withAuth<Ctx>(null, async (_req, { params }) => {
  const { id } = await params;
  const job = await loadJob(id);
  if (!job) return fail("Job not found", 404);
  return ok(job);
});

type EditBody = {
  date?: string;
  services?: { serviceId: string; price: number | string }[];
  discount?: number | string;
  discountType?: "flat" | "percent";
  status?: JobStatus;
  completedAt?: string | null;
  deliveredAt?: string | null;
  payments?: { amount: number | string; mode: string; at: string; by?: string }[];
  notes?: string;
  assignedTo?: string;
};

/**
 * { action: "status", status }                      → move job through the workflow
 * { action: "pay", amount, mode, collectedBy?, at? } → record a payment against the balance
 * { action: "update", notes?, assignedTo? }
 * { action: "edit", ...EditBody }                   → Super Admin correction of any detail
 */
export const PATCH = withAuth<Ctx>(null, async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();

  const entry = await ServiceEntry.findById(id);
  if (!entry) return fail("Job not found", 404);
  if (!entry.paymentType) entry.paymentType = "cash";

  let newCreatedAt: Date | null = null;

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

      entry.payments.push({
        amount,
        mode,
        at: entryDate(body.at, user),
        by: await receiverFor(mode, body.collectedBy, user),
      });
      entry.paidAmount = round2(paidOf(entry) + amount);
      entry.paymentType = balanceOf(entry) <= 0 ? mode : "due";
      break;
    }

    case "update": {
      if (body.notes !== undefined) entry.notes = String(body.notes).trim();
      if (body.assignedTo !== undefined) entry.assignedTo = body.assignedTo || undefined;
      break;
    }

    case "edit": {
      if (!can.editHistory(user.role)) return fail("Only the Super Admin can edit past job details", 403);
      const b = body as EditBody;
      const oldServiceIds = entry.services.map((s: { serviceId: unknown }) => String(s.serviceId)).sort();

      if (b.date) newCreatedAt = entryDate(b.date, user);

      if (b.services) {
        if (!b.services.length) return fail("A job needs at least one service");
        const known = new Map<string, string>(
          entry.services.map((s: { serviceId: unknown; name?: string }) => [String(s.serviceId), s.name || ""])
        );
        const catalog = await Service.find({ _id: { $in: b.services.map((s) => s.serviceId) } }).select("name").lean();
        for (const s of catalog) known.set(String(s._id), s.name);
        const items = b.services.map((s) => ({
          serviceId: s.serviceId,
          name: known.get(String(s.serviceId)) || undefined,
          price: Math.max(0, Number(s.price) || 0),
        }));
        if (items.some((i) => !i.name)) return fail("One of the selected services no longer exists");
        entry.services = items;
      }

      if (b.discountType) entry.discountType = b.discountType === "percent" ? "percent" : "flat";
      if (b.discount !== undefined) entry.discount = Math.max(0, Number(b.discount) || 0);
      const totals = calcTotals(
        entry.services.map((s: { price: number }) => s.price),
        entry.discount,
        entry.discountType
      );
      entry.subtotal = totals.subtotal;
      entry.total = totals.total;

      if (b.payments) {
        const payments = [];
        for (const p of b.payments) {
          const amount = round2(Number(p.amount) || 0);
          if (amount <= 0) return fail("Each payment needs an amount");
          const mode = p.mode === "online" ? "online" : "cash";
          if (mode === "cash" && p.by && !(await User.exists({ _id: p.by }))) throw new InputError("Payment collector not found");
          payments.push({
            amount,
            mode,
            at: entryDate(p.at, user),
            // online always goes to the online payee's account; cash keeps the chosen collector
            by: mode === "online" ? await receiverFor("online", p.by, user) : p.by || user.id,
          });
        }
        entry.payments = payments;
        entry.paidAmount = round2(payments.reduce((s, p) => s + p.amount, 0));
      } else if (typeof entry.paidAmount !== "number") {
        entry.paidAmount = paidOf(entry);
      }
      if (entry.paidAmount > entry.total + 0.001) return fail("Payments add up to more than the bill total");
      const lastMode = entry.payments.length ? entry.payments[entry.payments.length - 1].mode : "cash";
      entry.paymentType = balanceOf(entry) <= 0 ? lastMode : "due";

      if (b.status) {
        if (!JOB_STATUSES.includes(b.status)) return fail("Invalid status");
        entry.status = b.status;
      }
      if (b.completedAt !== undefined) entry.completedAt = b.completedAt ? entryDate(b.completedAt, user) : undefined;
      if (b.deliveredAt !== undefined) entry.deliveredAt = b.deliveredAt ? entryDate(b.deliveredAt, user) : undefined;
      if (b.notes !== undefined) entry.notes = String(b.notes).trim();
      if (b.assignedTo !== undefined) entry.assignedTo = b.assignedTo || undefined;

      // Services changed → give back what the old services used and deduct for the new ones
      const newServiceIds = entry.services.map((s: { serviceId: unknown }) => String(s.serviceId)).sort();
      if (b.services && newServiceIds.join() !== oldServiceIds.join()) {
        await reverseJob(id, user.id);
        await consumeForJob(id, newServiceIds, user.id);
      }
      break;
    }

    default:
      return fail("Unknown action");
  }

  await entry.save();
  // createdAt is immutable in Mongoose, so a corrected job date is written directly
  if (newCreatedAt) await ServiceEntry.collection.updateOne({ _id: entry._id }, { $set: { createdAt: newCreatedAt } });

  return ok(await loadJob(id));
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }, user) => {
  const { id } = await params;
  const deleted = await ServiceEntry.findByIdAndDelete(id);
  if (!deleted) return fail("Job not found", 404);
  await reverseJob(id, user.id); // return consumables to stock
  return ok(null, { message: "Job deleted" });
});
