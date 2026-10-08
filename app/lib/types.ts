// API response shapes used by the client pages.
import type { DiscountType, JobStatus, PaymentMode, PaymentType } from "./jobs";
import type { Role } from "./roles";

export type Bike = {
  _id: string;
  bikeNumber: string;
  ownerName?: string;
  phone?: string;
  model?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // present on list responses
  visits?: number;
  lastVisit?: string | null;
  spent?: number;
  inStudio?: boolean;
  due?: number;
};

export type Service = {
  _id: string;
  name: string;
  price: number;
  category: "basic" | "premium" | "addon";
  description?: string;
  duration?: number;
  sortOrder?: number;
  isActive: boolean;
  consumes?: { item: string; qty: number }[];
};

export type InventoryItem = {
  _id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  costPerUnit?: number;
  supplier?: string;
  notes?: string;
  isActive: boolean;
  updatedAt: string;
};

export type StockMovement = {
  _id: string;
  type: "in" | "out" | "adjust" | "job" | "job_reversal";
  qty: number;
  balanceAfter?: number;
  unitCost?: number;
  note?: string;
  job?: { _id: string; jobNo?: number } | null;
  by?: NamedRef;
  createdAt: string;
};

export type LowStockItem = { _id: string; name: string; stock: number; minStock: number; unit: string };

export type NamedRef = { _id: string; name: string } | null;

export type Job = {
  _id: string;
  jobNo?: number;
  bikeId: Bike | null;
  services: { _id: string; serviceId: NamedRef | string; name?: string; price: number }[];
  subtotal: number;
  discount: number;
  discountType: DiscountType;
  total: number;
  paymentType: PaymentType;
  paidAmount?: number;
  payments: { _id: string; amount: number; mode: PaymentMode; at: string; by?: NamedRef }[];
  status: JobStatus;
  notes?: string;
  assignedTo?: NamedRef;
  createdBy?: NamedRef;
  completedAt?: string;
  deliveredAt?: string;
  createdAt: string;
};

export type TeamMember = { _id: string; name: string; role: Role };

export type User = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: "Active" | "Inactive";
  createdAt: string;
};

export type Expense = {
  _id: string;
  title: string;
  amount: number;
  category: string;
  mode: PaymentMode;
  date: string;
  note?: string;
  createdBy?: NamedRef;
};

export function serviceName(s: Job["services"][number]) {
  if (s.name) return s.name;
  if (s.serviceId && typeof s.serviceId === "object") return s.serviceId.name;
  return "Service";
}

export type CashPosition = {
  userId: string;
  name: string;
  role: Role;
  collected: number;
  received: number;
  handedOver: number;
  spent: number;
  pending: number;
  inHand: number;
  available: number;
};

export type Handover = {
  _id: string;
  from: { _id: string; name: string; role?: Role } | null;
  to?: NamedRef;
  amount: number;
  note?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  createdAt: string;
  decidedAt?: string;
};

export type Punch = { at: string; lat?: number; lng?: number; accuracy?: number; distance?: number };

export type Shift = {
  _id: string;
  user: string | { _id: string; name: string; role?: Role };
  date: string;
  signIn: Punch;
  signOut?: Punch;
  breaks?: { start: Punch; end?: Punch }[];
  manual?: boolean;
  editedBy?: NamedRef;
  editedAt?: string;
  note?: string;
};

export type PaySettings = { type: "daily" | "hourly" | "monthly"; rate: number };
