// Shared between server and client — keep free of server-only imports.

export type Role = "ADMIN" | "MANAGER" | "USER";

export const ROLES: Role[] = ["ADMIN", "MANAGER", "USER"];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Super Admin",
  MANAGER: "Admin",
  USER: "Staff",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: "Owner — full access, including team accounts",
  MANAGER: "Runs the studio: jobs, services, inventory, expenses and reports",
  USER: "Technician: creates jobs, updates status, collects payments",
};

/** Super Admins and Admins: can see money, manage catalog & inventory, and delete records. */
export const MANAGERS: Role[] = ["ADMIN", "MANAGER"];

export const can = {
  manageUsers: (role: Role) => role === "ADMIN",
  manageStudio: (role: Role) => MANAGERS.includes(role),
  /** Back-date new jobs and correct past jobs (dates, services, payments) — Super Admin only. */
  editHistory: (role: Role) => role === "ADMIN",
};

/* ───────────── Permissions the Super Admin can switch on / off per role ───────────── */

export const PERMISSIONS = [
  { key: "editPrices", label: "Change service prices on a job", hint: "Otherwise the list / combo price is billed", defaults: { MANAGER: true, USER: false } },
  { key: "giveDiscount", label: "Give discounts", hint: "Flat ₹ or % off a new job", defaults: { MANAGER: true, USER: false } },
  { key: "seeAllJobs", label: "See every job", hint: "Otherwise only jobs they entered or are assigned to", defaults: { MANAGER: true, USER: false } },
  { key: "deleteJobs", label: "Delete jobs", hint: "Stock used by the job is put back", defaults: { MANAGER: true, USER: false } },
  { key: "approveCash", label: "Approve cash handovers", hint: "Receive cash from the team and see who holds cash", defaults: { MANAGER: true, USER: false } },
  { key: "recordExpenses", label: "Record expenses", hint: "Cash spent from their own cash in hand", defaults: { MANAGER: true, USER: true } },
  { key: "manageInventory", label: "Manage inventory", hint: "Add items, stock in / out, low-stock alerts", defaults: { MANAGER: true, USER: false } },
  { key: "manageServices", label: "Manage services & prices", hint: "Add or change the service list", defaults: { MANAGER: true, USER: false } },
  { key: "viewReports", label: "See reports", hint: "Revenue, profit and top services", defaults: { MANAGER: true, USER: false } },
] as const;

export type PermKey = (typeof PERMISSIONS)[number]["key"];
export type Perms = Record<PermKey, boolean>;
/** Roles whose permissions can be changed (the Super Admin always has everything). */
export type PermRole = "MANAGER" | "USER";
export type PermMatrix = Record<PermRole, Perms>;

export function defaultPermMatrix(): PermMatrix {
  const pick = (r: PermRole) => Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.defaults[r]])) as Perms;
  return { MANAGER: pick("MANAGER"), USER: pick("USER") };
}

/** What a role may do, given the saved matrix (missing entries fall back to the defaults). */
export function resolvePerms(role: Role, saved?: Partial<Record<PermRole, Partial<Perms>>> | null): Perms {
  if (role === "ADMIN") return Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])) as Perms;
  const base = defaultPermMatrix()[role];
  return { ...base, ...(saved?.[role] || {}) };
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  perms: Perms;
};

/** Whether this signed-in person has a permission (Super Admin: always). */
export function allowed(user: Pick<SessionUser, "role" | "perms">, key: PermKey) {
  return user.role === "ADMIN" || !!user.perms?.[key];
}
