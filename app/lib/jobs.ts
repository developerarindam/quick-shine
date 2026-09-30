// Job (service entry) domain helpers — shared between server and client.

export type JobStatus = "pending" | "in_progress" | "completed" | "delivered";
export type PaymentMode = "cash" | "online";
export type PaymentType = PaymentMode | "due";
export type DiscountType = "flat" | "percent";

export const JOB_STATUSES: JobStatus[] = ["pending", "in_progress", "completed", "delivered"];
export const ACTIVE_STATUSES: JobStatus[] = ["pending", "in_progress", "completed"];

export const STATUS_META: Record<JobStatus, { label: string; short: string; tone: Tone; next?: JobStatus; action?: string }> = {
  pending: { label: "Waiting", short: "Waiting", tone: "amber", next: "in_progress", action: "Start work" },
  in_progress: { label: "In progress", short: "Working", tone: "blue", next: "completed", action: "Mark ready" },
  completed: { label: "Ready for pickup", short: "Ready", tone: "violet", next: "delivered", action: "Mark delivered" },
  delivered: { label: "Delivered", short: "Delivered", tone: "green" },
};

export type Tone = "gray" | "amber" | "blue" | "violet" | "green" | "red" | "brand";

type Payable = {
  total: number;
  paidAmount?: number | null;
  paymentType?: PaymentType;
};

/** Amount received so far. Old entries without paidAmount were either fully paid or fully due. */
export function paidOf(job: Payable): number {
  if (typeof job.paidAmount === "number") return job.paidAmount;
  return job.paymentType === "due" ? 0 : job.total;
}

export function balanceOf(job: Payable): number {
  return Math.max(0, round2(job.total - paidOf(job)));
}

export function paymentState(job: Payable): { label: string; tone: Tone } {
  const bal = balanceOf(job);
  if (bal <= 0) return { label: "Paid", tone: "green" };
  if (paidOf(job) > 0) return { label: "Partly paid", tone: "amber" };
  return { label: "Due", tone: "red" };
}

export function calcTotals(prices: number[], discount: number, discountType: DiscountType) {
  const subtotal = round2(prices.reduce((sum, p) => sum + (Number(p) || 0), 0));
  const d = Math.max(0, Number(discount) || 0);
  const discountAmount = round2(
    discountType === "percent" ? (subtotal * Math.min(d, 100)) / 100 : Math.min(d, subtotal)
  );
  const total = round2(Math.max(0, subtotal - discountAmount));
  return { subtotal, discountAmount, total };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function jobLabel(job: { jobNo?: number; _id: string }) {
  return job.jobNo ? `#${job.jobNo}` : `#${job._id.slice(-5).toUpperCase()}`;
}
