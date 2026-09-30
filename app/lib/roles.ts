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
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
};
