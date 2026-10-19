// Import old jobs from a sheet — Super Admin only.
// The client parses the file and resolves codes/people; this route validates every row
// (dryRun: true → report only) and then creates bikes, jobs and payments in bulk.
import crypto from "crypto";
import Bike from "@/app/models/Bike";
import Service from "@/app/models/Service";
import ServiceEntry from "@/app/models/ServiceEntry";
import Counter from "@/app/models/Counter";
import ImportBatch from "@/app/models/ImportBatch";
import User from "@/app/models/User";
import { fail, normalizeBikeNumber, ok, withAuth } from "@/app/lib/auth";
import { dayKey } from "@/app/lib/attendance";
import { onlinePayee } from "@/app/lib/jobEntry";
import { round2 } from "@/app/lib/jobs";

type InRow = {
  line: number;
  date: string; // yyyy-mm-dd (studio day)
  bikeNumber: string;
  serviceIds: string[];
  cash: number;
  online: number;
  collectorId?: string | null;
  assignedTo?: string | null;
  notes?: string;
  free?: boolean; // done at no charge
};

type Issue = { line: number; level: "error" | "warning"; message: string };

const OFFSET = process.env.STUDIO_UTC_OFFSET || "+05:30";
const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const MAX_ROWS = 2000;

export const POST = withAuth(["ADMIN"], async (req, _ctx, admin) => {
  const { rows, dryRun, fileName, skipDuplicates = true } = (await req.json()) as {
    rows: InRow[];
    dryRun?: boolean;
    fileName?: string;
    skipDuplicates?: boolean;
  };
  if (!Array.isArray(rows) || rows.length === 0) return fail("No rows to import");
  if (rows.length > MAX_ROWS) return fail(`Import at most ${MAX_ROWS} rows at a time`);

  const [services, bikes, users, payee] = await Promise.all([
    Service.find().select("name price").lean(),
    Bike.find().select("bikeNumber").lean(),
    User.find().select("_id").lean(),
    onlinePayee(),
  ]);
  const serviceById = new Map(services.map((s) => [String(s._id), s]));
  const bikeByNo = new Map(bikes.map((b) => [compact(b.bikeNumber), b]));
  const userIds = new Set(users.map((u) => String(u._id)));

  // existing jobs on the sheet's days, to spot rows that were already entered
  const days = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  const existing = days.length
    ? await ServiceEntry.find({
        createdAt: { $gte: new Date(`${days[0]}T00:00:00${OFFSET}`), $lte: new Date(`${days[days.length - 1]}T23:59:59.999${OFFSET}`) },
      })
        .select("bikeId createdAt")
        .lean()
    : [];
  const bikeNoById = new Map(bikes.map((b) => [String(b._id), compact(b.bikeNumber)]));
  const alreadyIn = new Set(existing.map((j) => `${bikeNoById.get(String(j.bikeId))}|${dayKey(new Date(j.createdAt))}`));

  const issues: Issue[] = [];
  const seenInSheet = new Set<string>();
  const valid: (InRow & { key: string; dup: boolean })[] = [];
  const today = dayKey();

  for (const r of rows) {
    const errs: string[] = [];
    const real = /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") && new Date(`${r.date}T12:00:00Z`).toISOString().slice(0, 10) === r.date;
    if (!real) errs.push("date missing or not a real date");
    else if (r.date > today) errs.push("date is in the future");
    const no = compact(r.bikeNumber || "");
    if (no.length < 4) errs.push("vehicle number missing");
    if (!r.serviceIds?.length) errs.push("no service");
    else if (r.serviceIds.some((id) => !serviceById.has(String(id)))) errs.push("a service isn't in your list");
    if (!(Number(r.cash) >= 0) || !(Number(r.online) >= 0)) errs.push("cash / online must be numbers");
    if (r.collectorId && !userIds.has(String(r.collectorId))) errs.push("collector not found");
    if (r.assignedTo && !userIds.has(String(r.assignedTo))) errs.push("'done by' person not found");
    if (errs.length) {
      issues.push({ line: r.line, level: "error", message: errs.join(", ") });
      continue;
    }
    const key = `${no}|${r.date}`;
    const dup = alreadyIn.has(key);
    if (dup) issues.push({ line: r.line, level: "warning", message: "this bike already has a job in the app on this day" });
    if (seenInSheet.has(key)) issues.push({ line: r.line, level: "warning", message: "same bike appears twice on this day in the sheet" });
    seenInSheet.add(key);
    if (!r.free && Number(r.cash) + Number(r.online) === 0) {
      issues.push({ line: r.line, level: "warning", message: "no amount — will be added as unpaid (due) at the list price" });
    }
    valid.push({ ...r, key, dup });
  }

  const toImport = valid.filter((r) => !(skipDuplicates && r.dup));
  const summary = {
    rows: rows.length,
    ready: toImport.length,
    errors: issues.filter((i) => i.level === "error").length,
    duplicatesSkipped: valid.length - toImport.length,
    cash: round2(toImport.reduce((s, r) => s + Number(r.cash), 0)),
    online: round2(toImport.reduce((s, r) => s + Number(r.online), 0)),
    newBikes: new Set(toImport.map((r) => compact(r.bikeNumber)).filter((n) => !bikeByNo.has(n))).size,
  };
  if (dryRun || toImport.length === 0) return ok({ summary, issues });

  // ── Import ──
  const batchId = `imp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;

  // 1. bikes that don't exist yet
  const newBikeDocs = [];
  for (const r of toImport) {
    const n = compact(r.bikeNumber);
    if (bikeByNo.has(n)) continue;
    const doc = new Bike({ bikeNumber: normalizeBikeNumber(r.bikeNumber), importBatch: batchId });
    bikeByNo.set(n, doc);
    newBikeDocs.push(doc);
  }
  if (newBikeDocs.length) await Bike.insertMany(newBikeDocs);

  // 2. reserve a block of job numbers in one go
  const counter = await Counter.findOneAndUpdate({ _id: "job" }, { $inc: { seq: toImport.length } }, { upsert: true, returnDocument: "after" });
  let jobNo = counter.seq - toImport.length;

  // 3. jobs — keep the sheet's order within a day (10:00, 10:01, …)
  const perDay = new Map<string, number>();
  const docs = toImport.map((r) => {
    const n = perDay.get(r.date) || 0;
    perDay.set(r.date, n + 1);
    const at = new Date(new Date(`${r.date}T10:00:00${OFFSET}`).getTime() + n * 60_000);

    const list = r.serviceIds.map((id) => serviceById.get(String(id))!);
    const listTotal = list.reduce((s, x) => s + x.price, 0);
    const cash = round2(Number(r.cash) || 0);
    const online = round2(Number(r.online) || 0);
    const paidTotal = round2(cash + online);

    // Services at their list price. If the customer paid less, the difference is a discount
    // (e.g. ₹99 for a ₹100 wash = ₹1 off). If they paid more, prices are scaled up to match.
    let items = list.map((s) => ({ serviceId: s._id, name: s.name, price: s.price }));
    let subtotal = listTotal;
    let discount = 0;
    if (r.free) {
      discount = listTotal;
    } else if (paidTotal > 0 && paidTotal < listTotal) {
      discount = round2(listTotal - paidTotal);
    } else if (paidTotal > listTotal) {
      let allocated = 0;
      items = list.map((s, i) => {
        const share =
          i === list.length - 1
            ? round2(paidTotal - allocated)
            : round2(listTotal > 0 ? (paidTotal * s.price) / listTotal : paidTotal / list.length);
        allocated = round2(allocated + share);
        return { serviceId: s._id, name: s.name, price: share };
      });
      subtotal = paidTotal;
    }
    const total = round2(subtotal - discount);

    const payments = [];
    if (cash > 0) payments.push({ amount: cash, mode: "cash", at, by: r.collectorId || admin.id });
    if (online > 0) payments.push({ amount: online, mode: "online", at, by: payee?._id || admin.id });
    const paid = round2(cash + online);

    return {
      jobNo: ++jobNo,
      bikeId: bikeByNo.get(compact(r.bikeNumber))!._id,
      services: items,
      subtotal,
      discount,
      discountType: "flat",
      total,
      paidAmount: Math.min(paid, total),
      paymentType: paid >= total ? (online > cash ? "online" : "cash") : "due",
      payments,
      status: "delivered",
      notes: r.notes?.trim() || undefined,
      assignedTo: r.assignedTo || undefined,
      createdBy: admin.id,
      completedAt: at,
      deliveredAt: at,
      importBatch: batchId,
      createdAt: at,
      updatedAt: new Date(),
    };
  });
  // raw insert so the sheet's dates are kept as createdAt (not "now")
  await ServiceEntry.collection.insertMany(
    // build full documents (ids for service lines & payments, defaults), keep the sheet date
    docs.map((d) => ({ ...new ServiceEntry(d).toObject(), createdAt: d.createdAt, updatedAt: d.updatedAt }))
  );

  await ImportBatch.create({
    _id: batchId,
    kind: "jobs",
    fileName,
    by: admin.id,
    rows: rows.length,
    jobs: docs.length,
    bikesCreated: newBikeDocs.length,
    skipped: rows.length - docs.length,
    cash: summary.cash,
    online: summary.online,
    from: days[0],
    to: days[days.length - 1],
  });

  return ok({ summary: { ...summary, imported: docs.length, batchId }, issues });
});

export const GET = withAuth(["ADMIN"], async () => {
  const batches = await ImportBatch.find().populate("by", "name").sort({ createdAt: -1 }).limit(20).lean();
  return ok(batches);
});
