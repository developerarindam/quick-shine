// Server-side validation shared by job create / edit / payment routes.
import { Types } from "mongoose";
import User from "@/app/models/User";
import { allowed, can, type SessionUser } from "@/app/lib/roles";

/** A validation problem to show the user (returned as HTTP 400). */
export class InputError extends Error {
  name = "InputError";
}

/**
 * Which jobs someone may see: everyone with "See every job" → all; otherwise only jobs
 * assigned to them or that they entered. ObjectIds so it also works inside aggregate $match.
 */
export function jobScope(user: SessionUser): Record<string, unknown> {
  if (allowed(user, "seeAllJobs")) return {};
  const id = new Types.ObjectId(user.id);
  return { $or: [{ assignedTo: id }, { createdBy: id }] };
}

/** True when this (staff) user may open / act on the job. */
export function canSeeJob(user: SessionUser, job: { assignedTo?: unknown; createdBy?: unknown }) {
  if (allowed(user, "seeAllJobs")) return true;
  const ref = (v: unknown) => (v && typeof v === "object" && "_id" in v ? String((v as { _id: unknown })._id) : String(v));
  return ref(job.assignedTo) === user.id || ref(job.createdBy) === user.id;
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The date a job (or payment) happened. Only the Super Admin may set it explicitly —
 * everyone else always gets "now". Throws a user-facing message when invalid.
 */
export function entryDate(value: unknown, user: SessionUser, fallback = new Date()): Date {
  if (!value || !can.editHistory(user.role)) return fallback;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new InputError("Invalid date and time");
  if (d.getTime() > Date.now() + FUTURE_TOLERANCE_MS) throw new InputError("Date and time can't be in the future");
  if (d.getFullYear() < 2000) throw new InputError("Date looks wrong — check the year");
  return d;
}

/** Who physically received a payment. Defaults to the signed-in user; must be an active team member. */
export async function collectorId(value: unknown, user: SessionUser): Promise<string> {
  if (!value || String(value) === user.id) return user.id;
  const exists = await User.exists({ _id: String(value), status: "Active" });
  if (!exists) throw new InputError("The person who collected the payment wasn't found");
  return String(value);
}

// ── Online payments all land in one account ──
// Every UPI / online payment is credited to this person, whoever records it.
const ONLINE_PAYEE_EMAIL = (process.env.ONLINE_PAYEE_EMAIL || "chandanalltime4u@gmail.com").toLowerCase();
let payeeCache: { value: { _id: string; name: string } | null; expires: number } | null = null;

/** The team member whose account receives online payments (null if no such active user). */
export async function onlinePayee(): Promise<{ _id: string; name: string } | null> {
  if (payeeCache && payeeCache.expires > Date.now()) return payeeCache.value;
  const u = await User.findOne({ email: ONLINE_PAYEE_EMAIL, status: "Active" }).select("name").lean();
  const value = u ? { _id: String(u._id), name: u.name } : null;
  payeeCache = { value, expires: Date.now() + 60_000 };
  return value;
}

/** Who a payment is credited to: online → the online payee; cash → whoever collected it. */
export async function receiverFor(mode: string, requested: unknown, user: SessionUser): Promise<string> {
  if (mode === "online") {
    const payee = await onlinePayee();
    if (payee) return payee._id;
  }
  return collectorId(requested, user);
}

/**
 * Whose money an expense came from.
 * online → always the online account holder (Chandan Manna).
 * cash   → only the Super Admin may pick whose cash; everyone else spends their own.
 */
export async function expensePayer(mode: string, requested: unknown, user: SessionUser): Promise<string> {
  if (mode === "online") {
    const payee = await onlinePayee();
    return payee ? payee._id : user.id;
  }
  if (!can.editHistory(user.role)) return user.id;
  return collectorId(requested, user);
}
