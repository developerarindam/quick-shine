import ServiceEntry, { hydrateJobs } from "@/app/models/ServiceEntry";
import Bike from "@/app/models/Bike";
import Service from "@/app/models/Service";
import "@/app/models/User";
import { nextSequence } from "@/app/models/Counter";
import { consumeForJob } from "@/app/lib/inventory";
import { collectorId, entryDate, receiverFor } from "@/app/lib/jobEntry";
import { bikeNumberRegex, fail, normalizeBikeNumber, ok, parseRange, withAuth } from "@/app/lib/auth";
import { ACTIVE_STATUSES, JOB_STATUSES, calcTotals, type JobStatus } from "@/app/lib/jobs";

/**
 * ?view=active → all unfinished jobs (any date)
 * ?view=due    → all jobs with money still to collect (any date)
 * otherwise    → jobs created in ?from=&to= (default: today)
 */
export const GET = withAuth(null, async (req) => {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  let filter: Record<string, unknown>;
  if (view === "active") {
    filter = { status: { $in: ACTIVE_STATUSES } };
  } else if (view === "due") {
    filter = { paymentType: "due" };
  } else {
    const { from, to } = parseRange(searchParams);
    filter = { createdAt: { $gte: from, $lte: to } };
  }

  const status = searchParams.get("status");
  if (status && JOB_STATUSES.includes(status as JobStatus)) filter.status = status;

  const data = await ServiceEntry.find(filter)
    .sort({ createdAt: view === "active" ? 1 : -1 })
    .lean();

  return ok(await hydrateJobs(data, { bikes: true }));
});

type NewJobBody = {
  bikeId?: string;
  bike?: { bikeNumber: string; ownerName?: string; phone?: string; model?: string };
  services: { serviceId: string; price: number }[];
  discount?: number;
  discountType?: "flat" | "percent";
  paymentType: "cash" | "online" | "due";
  advance?: number;
  advanceMode?: "cash" | "online";
  status?: JobStatus;
  assignedTo?: string;
  notes?: string;
  /** Super Admin only: when the job actually happened (defaults to now) */
  date?: string;
  /** Who received the cash / payment (defaults to the signed-in user) */
  collectedBy?: string;
};

export const POST = withAuth(null, async (req, _ctx, user) => {
  const body: NewJobBody = await req.json();

  const when = entryDate(body.date, user);
  const collector = await collectorId(body.collectedBy, user);

  // 1. Resolve the bike — existing id, or find/create by number
  let bikeId = body.bikeId;
  if (!bikeId && body.bike?.bikeNumber?.trim()) {
    const { bikeNumber, ownerName, phone, model } = body.bike;
    let bike = await Bike.findOne({ bikeNumber: bikeNumberRegex(bikeNumber) });
    if (!bike) {
      bike = await Bike.create({ bikeNumber: normalizeBikeNumber(bikeNumber), ownerName, phone, model });
    } else {
      // fill in details the existing record is missing
      if (!bike.ownerName && ownerName) bike.ownerName = ownerName;
      if (!bike.phone && phone) bike.phone = phone;
      if (!bike.model && model) bike.model = model;
      await bike.save();
    }
    bikeId = String(bike._id);
  }
  if (!bikeId) return fail("Select or enter a bike");
  if (!(await Bike.exists({ _id: bikeId }))) return fail("Bike not found", 404);

  // 2. Services — snapshot names, keep the (possibly adjusted) price from the form
  if (!Array.isArray(body.services) || body.services.length === 0) {
    return fail("Select at least one service");
  }
  const catalog = await Service.find({ _id: { $in: body.services.map((s) => s.serviceId) } })
    .select("name")
    .lean();
  const names = new Map(catalog.map((s) => [String(s._id), s.name]));
  const items = body.services.map((s) => ({
    serviceId: s.serviceId,
    name: names.get(String(s.serviceId)),
    price: Math.max(0, Number(s.price) || 0),
  }));
  if (items.some((i) => !i.name)) return fail("One of the selected services no longer exists");

  // 3. Totals & payment
  const discountType = body.discountType === "percent" ? "percent" : "flat";
  const discount = Math.max(0, Number(body.discount) || 0);
  const { subtotal, total } = calcTotals(items.map((i) => i.price), discount, discountType);

  if (!["cash", "online", "due"].includes(body.paymentType)) return fail("Choose a payment type");

  const payments: { amount: number; mode: string; at: Date; by: string }[] = [];
  let paidAmount = 0;
  let paymentType = body.paymentType;

  if (body.paymentType !== "due") {
    if (total > 0) {
      const by = await receiverFor(body.paymentType, body.collectedBy, user);
      payments.push({ amount: total, mode: body.paymentType, at: when, by });
    }
    paidAmount = total;
  } else {
    const advance = Math.min(Math.max(0, Number(body.advance) || 0), total);
    if (advance > 0) {
      const mode = body.advanceMode === "online" ? "online" : "cash";
      payments.push({ amount: advance, mode, at: when, by: mode === "online" ? await receiverFor(mode, null, user) : collector });
      paidAmount = advance;
      if (advance >= total) paymentType = mode;
    }
    if (total === 0) paymentType = "cash";
  }

  const status: JobStatus = JOB_STATUSES.includes(body.status as JobStatus) ? body.status! : "in_progress";
  // Saved with explicit timestamps so a back-dated job lands on the right day in every report
  const entry = new ServiceEntry({
    jobNo: await nextSequence("job"),
    bikeId,
    services: items,
    subtotal,
    discount,
    discountType,
    total,
    paymentType,
    paidAmount,
    payments,
    status,
    notes: body.notes?.trim() || undefined,
    assignedTo: body.assignedTo || user.id,
    createdBy: user.id,
    completedAt: status === "completed" || status === "delivered" ? when : undefined,
    deliveredAt: status === "delivered" ? when : undefined,
    createdAt: when,
    updatedAt: new Date(),
  });
  await entry.save({ timestamps: false });

  // Deduct the consumables these services use; tell the user if anything is now running low
  const lowStock = await consumeForJob(String(entry._id), items.map((i) => String(i.serviceId)), user.id);

  return ok({ _id: entry._id, jobNo: entry.jobNo, lowStock });
});
