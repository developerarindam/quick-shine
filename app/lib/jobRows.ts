// Jobs list: one flat row per job, plus the advanced filters / sorting used by
// the list view, the grid view, the totals strip and the Excel export.
import { STATUS_META, balanceOf, jobLabel, paidOf, type JobStatus } from "./jobs";
import { serviceName, type Job } from "./types";

export type PayKind = "cash" | "online" | "mixed" | "unpaid";
export type PayState = "paid" | "partial" | "due";

export type JobRow = {
  id: string;
  label: string; // #123
  jobNo: number;
  inAt: Date;
  doneAt: Date | null; // delivered, else ready
  doneKind: "delivered" | "ready" | null;
  bikeNumber: string;
  owner: string;
  phone: string;
  model: string;
  services: string; // "Foam Wash, Chain Clean & Lube"
  serviceIds: string[];
  doneBy: string;
  doneById: string;
  status: JobStatus;
  statusLabel: string;
  subtotal: number;
  discount: number;
  total: number;
  cash: number;
  online: number;
  due: number;
  collectedBy: string; // names of people who received money
  collectorIds: string[];
  payKind: PayKind;
  payState: PayState;
  notes: string;
  job: Job;
};

const idOf = (ref: unknown) => (ref && typeof ref === "object" ? String((ref as { _id: string })._id) : ref ? String(ref) : "");

export function toRow(job: Job): JobRow {
  let cash = 0;
  let online = 0;
  const collectors = new Map<string, string>();
  if (job.payments.length) {
    for (const p of job.payments) {
      if (p.mode === "online") online += p.amount;
      else cash += p.amount;
      if (p.by?._id) collectors.set(p.by._id, p.by.name);
    }
  } else {
    // entries from before payment tracking: paid in full at billing
    const paid = paidOf(job);
    if (job.paymentType === "online") online += paid;
    else cash += paid;
  }
  const due = balanceOf(job);
  const paid = cash + online;
  const doneAt = job.deliveredAt || job.completedAt;
  const b = job.bikeId;
  return {
    id: job._id,
    label: jobLabel(job),
    jobNo: job.jobNo || 0,
    inAt: new Date(job.createdAt),
    doneAt: doneAt ? new Date(doneAt) : null,
    doneKind: job.deliveredAt ? "delivered" : job.completedAt ? "ready" : null,
    bikeNumber: b?.bikeNumber || "",
    owner: b?.ownerName || "",
    phone: b?.phone || "",
    model: b?.model || "",
    services: job.services.map(serviceName).join(", "),
    serviceIds: job.services.map((s) => idOf(s.serviceId)),
    doneBy: job.assignedTo?.name || "",
    doneById: job.assignedTo?._id || "",
    status: job.status,
    statusLabel: STATUS_META[job.status]?.short || job.status,
    subtotal: job.subtotal,
    discount: Math.max(0, Math.round((job.subtotal - job.total) * 100) / 100),
    total: job.total,
    cash,
    online,
    due,
    collectedBy: [...collectors.values()].join(", "),
    collectorIds: [...collectors.keys()],
    payKind: paid <= 0 ? "unpaid" : cash > 0 && online > 0 ? "mixed" : online > 0 ? "online" : "cash",
    payState: due <= 0 ? "paid" : paid > 0 ? "partial" : "due",
    notes: job.notes || "",
    job,
  };
}

/* ───────────── Filters ───────────── */

export type JobFilters = {
  pay: PayKind[]; // empty = any
  pstate: PayState[];
  min: number | null;
  max: number | null;
  svc: string[]; // service ids
  svcAll: boolean; // true = must include all chosen services
  st: JobStatus[];
  doneBy: string; // user id
  coll: string; // user id who collected money
  disc: "" | "yes" | "no";
};

export const EMPTY_FILTERS: JobFilters = { pay: [], pstate: [], min: null, max: null, svc: [], svcAll: false, st: [], doneBy: "", coll: "", disc: "" };

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** Filters ⇄ URL params (f_pay=cash,online&f_min=100 …) */
export function filtersFromParams(p: URLSearchParams): JobFilters {
  return {
    pay: list(p.get("f_pay")) as PayKind[],
    pstate: list(p.get("f_ps")) as PayState[],
    min: num(p.get("f_min")),
    max: num(p.get("f_max")),
    svc: list(p.get("f_svc")),
    svcAll: p.get("f_svcall") === "1",
    st: list(p.get("f_st")) as JobStatus[],
    doneBy: p.get("f_done") || "",
    coll: p.get("f_coll") || "",
    disc: (p.get("f_disc") as JobFilters["disc"]) || "",
  };
}

export function filtersToParams(f: JobFilters): Record<string, string | null> {
  const join = (a: string[]) => (a.length ? a.join(",") : null);
  return {
    f_pay: join(f.pay),
    f_ps: join(f.pstate),
    f_min: f.min === null ? null : String(f.min),
    f_max: f.max === null ? null : String(f.max),
    f_svc: join(f.svc),
    f_svcall: f.svcAll && f.svc.length > 1 ? "1" : null,
    f_st: join(f.st),
    f_done: f.doneBy || null,
    f_coll: f.coll || null,
    f_disc: f.disc || null,
  };
}

export function activeFilterCount(f: JobFilters) {
  return (
    (f.pay.length ? 1 : 0) +
    (f.pstate.length ? 1 : 0) +
    (f.min !== null || f.max !== null ? 1 : 0) +
    (f.svc.length ? 1 : 0) +
    (f.st.length ? 1 : 0) +
    (f.doneBy ? 1 : 0) +
    (f.coll ? 1 : 0) +
    (f.disc ? 1 : 0)
  );
}

export function applyFilters(rows: JobRow[], f: JobFilters) {
  return rows.filter((r) => {
    if (f.pay.length && !f.pay.includes(r.payKind)) return false;
    if (f.pstate.length && !f.pstate.includes(r.payState)) return false;
    if (f.min !== null && r.total < f.min) return false;
    if (f.max !== null && r.total > f.max) return false;
    if (f.svc.length) {
      const has = (id: string) => r.serviceIds.includes(id);
      if (f.svcAll ? !f.svc.every(has) : !f.svc.some(has)) return false;
    }
    if (f.st.length && !f.st.includes(r.status)) return false;
    if (f.doneBy && r.doneById !== f.doneBy) return false;
    if (f.coll && !r.collectorIds.includes(f.coll)) return false;
    if (f.disc === "yes" && !(r.discount > 0)) return false;
    if (f.disc === "no" && r.discount > 0) return false;
    return true;
  });
}

/* ───────────── Sorting ───────────── */

export type SortKey = "new" | "old" | "amt_desc" | "amt_asc" | "due" | "bike" | "jobno" | "done";

export const SORT_LABEL: Record<SortKey, string> = {
  new: "Newest first",
  old: "Oldest first",
  amt_desc: "Amount: high → low",
  amt_asc: "Amount: low → high",
  due: "Most due first",
  bike: "Bike number A → Z",
  jobno: "Job # (ascending)",
  done: "Recently done",
};

export function sortRows(rows: JobRow[], key: SortKey) {
  const by: Record<SortKey, (a: JobRow, b: JobRow) => number> = {
    new: (a, b) => b.inAt.getTime() - a.inAt.getTime(),
    old: (a, b) => a.inAt.getTime() - b.inAt.getTime(),
    amt_desc: (a, b) => b.total - a.total,
    amt_asc: (a, b) => a.total - b.total,
    due: (a, b) => b.due - a.due || b.inAt.getTime() - a.inAt.getTime(),
    bike: (a, b) => a.bikeNumber.localeCompare(b.bikeNumber),
    jobno: (a, b) => a.jobNo - b.jobNo,
    done: (a, b) => (b.doneAt?.getTime() || 0) - (a.doneAt?.getTime() || 0),
  };
  return [...rows].sort(by[key]);
}

export function totalsOf(rows: JobRow[]) {
  const t = { count: rows.length, subtotal: 0, discount: 0, total: 0, cash: 0, online: 0, due: 0 };
  for (const r of rows) {
    t.subtotal += r.subtotal;
    t.discount += r.discount;
    t.total += r.total;
    t.cash += r.cash;
    t.online += r.online;
    t.due += r.due;
  }
  return t;
}
