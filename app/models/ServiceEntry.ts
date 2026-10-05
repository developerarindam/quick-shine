// models/ServiceEntry.ts — a "job": one visit of a bike to the studio
import mongoose from "mongoose";

const ServiceItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  // Snapshot so the bill still reads correctly if the service is renamed or removed
  name: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
});

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  mode: { type: String, enum: ["cash", "online"], required: true },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const ServiceEntrySchema = new mongoose.Schema(
  {
    jobNo: {
      type: Number,
      index: true,
    },
    bikeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bike",
      required: true,
    },
    services: [ServiceItemSchema],

    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    total: {
      type: Number,
      required: true,
    },
    // "due" while any balance is left; otherwise the mode that settled the bill
    paymentType: {
      type: String,
      enum: ["cash", "online", "due"],
      required: true,
    },
    // No default: entries created before payment tracking derive it from paymentType
    paidAmount: {
      type: Number,
    },
    payments: [PaymentSchema],

    // Entries created before the job workflow existed are treated as delivered
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "delivered"],
      default: "delivered",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true }
);

ServiceEntrySchema.index({ createdAt: -1 });
ServiceEntrySchema.index({ bikeId: 1, createdAt: -1 });
// payment-date queries (collections, cash, bike totals) and the Dues tab
ServiceEntrySchema.index({ "payments.at": 1 });
ServiceEntrySchema.index({ paymentType: 1 });

/**
 * Fill in fields that entries created by older versions of the app don't have.
 * Needed for .lean() results, which skip schema defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeJob<T extends Record<string, any>>(job: T): T {
  return {
    ...job,
    status: job.status ?? "delivered",
    paymentType: job.paymentType ?? "cash",
    payments: job.payments ?? [],
    services: job.services ?? [],
  };
}

/**
 * Resolves a batch of lean jobs' references (bike, service names, staff names) with one
 * parallel round of queries — much faster than chained .populate() calls on a remote DB.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hydrateJobs<T extends Record<string, any>>(jobs: T[], opts: { bikes?: boolean } = {}) {
  const ids = (list: unknown[]) => [...new Set(list.filter(Boolean).map(String))];
  const userIds = ids(jobs.flatMap((j) => [j.assignedTo, j.createdBy, ...(j.payments || []).map((p: { by?: unknown }) => p.by)]));
  const serviceIds = ids(jobs.flatMap((j) => (j.services || []).filter((s: { name?: string }) => !s.name).map((s: { serviceId: unknown }) => s.serviceId)));
  const bikeIds = opts.bikes ? ids(jobs.map((j) => j.bikeId)) : [];

  const [users, services, bikes] = await Promise.all([
    userIds.length ? mongoose.model("User").find({ _id: { $in: userIds } }).select("name").lean() : [],
    serviceIds.length ? mongoose.model("Service").find({ _id: { $in: serviceIds } }).select("name").lean() : [],
    bikeIds.length ? mongoose.model("Bike").find({ _id: { $in: bikeIds } }).lean() : [],
  ]);
  const byId = <D extends { _id: unknown }>(docs: D[]) => new Map(docs.map((d) => [String(d._id), d]));
  const u = byId(users as { _id: unknown; name: string }[]);
  const s = byId(services as { _id: unknown; name: string }[]);
  const b = byId(bikes as { _id: unknown }[]);
  const ref = (id: unknown) => (id ? u.get(String(id)) || null : null);

  return jobs.map((j) =>
    normalizeJob({
      ...j,
      bikeId: opts.bikes ? b.get(String(j.bikeId)) || null : j.bikeId,
      assignedTo: ref(j.assignedTo),
      createdBy: ref(j.createdBy),
      services: (j.services || []).map((it: { name?: string; serviceId: unknown }) => ({
        ...it,
        serviceId: it.name ? it.serviceId : s.get(String(it.serviceId)) || null,
      })),
      payments: (j.payments || []).map((p: { by?: unknown }) => ({ ...p, by: ref(p.by) })),
    })
  );
}

export default mongoose.models.ServiceEntry ||
  mongoose.model("ServiceEntry", ServiceEntrySchema);
