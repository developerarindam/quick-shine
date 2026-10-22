// Server side: writes the activity log. Every change made through withAuth is recorded
// automatically; sign-in / sign-out are recorded by their routes.
import ActivityLog from "@/app/models/ActivityLog";
import type { SessionUser } from "@/app/lib/roles";

const SECRET = /pass(word)?|token|secret/i;
const MAX_JSON = 3000;

export function areaOf(path: string) {
  if (path.startsWith("/api/service-entry") || path.startsWith("/api/bikes") || path.startsWith("/api/import")) return "jobs";
  if (path.startsWith("/api/expenses") || path.startsWith("/api/cash") || path.startsWith("/api/payroll")) return "money";
  if (path.startsWith("/api/users") || path.startsWith("/api/profile") || path.startsWith("/api/permissions")) return "team";
  if (path.startsWith("/api/inventory") || path.startsWith("/api/services")) return "stock";
  if (path.startsWith("/api/attendance")) return "attendance";
  if (path.startsWith("/api/login") || path.startsWith("/api/logout")) return "signin";
  return "settings";
}

/** Drops secrets, shortens long lists (e.g. an import's rows) and caps the size. */
function scrub(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    if (value.length > 20) return { items: value.length };
    return value.map((v) => scrub(v, depth + 1));
  }
  if (value && typeof value === "object") {
    if (depth > 3) return "…";
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET.test(k) ? "••••" : scrub(v, depth + 1)])
    );
  }
  if (typeof value === "string" && value.length > 300) return value.slice(0, 300) + "…";
  return value;
}

function capped(value: unknown) {
  const v = scrub(value);
  return JSON.stringify(v ?? null).length > MAX_JSON ? { note: "too large to keep" } : v;
}

/** The identifying bits of a response's `data` (job number, name, amount …). */
function summarize(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const d = data as Record<string, unknown>;
  const keep = ["_id", "jobNo", "name", "title", "amount", "status", "bikeNumber", "total", "label"];
  const out = Object.fromEntries(keep.filter((k) => d[k] !== undefined && typeof d[k] !== "object").map((k) => [k, d[k]]));
  if (d._id) out._id = String(d._id);
  return Object.keys(out).length ? out : undefined;
}

export function requestMeta(req: Request) {
  return {
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || undefined,
    device: req.headers.get("user-agent")?.slice(0, 200) || undefined,
  };
}

export async function logActivity(entry: {
  user?: Pick<SessionUser, "id" | "name" | "role"> | null;
  name?: string;
  method: string;
  path: string;
  status: number;
  action?: string;
  detail?: unknown;
  responseBody?: string;
  req: Request;
}) {
  try {
    let detail = entry.detail;
    let result: unknown;
    if (entry.responseBody) {
      try {
        result = summarize(JSON.parse(entry.responseBody).data);
      } catch {
        // not JSON
      }
    }
    if (typeof detail === "string") {
      try {
        detail = detail ? JSON.parse(detail) : undefined;
      } catch {
        detail = undefined;
      }
    }
    let action = entry.action;
    if (!action && detail && typeof detail === "object" && "action" in detail) action = String((detail as { action: unknown }).action);
    await ActivityLog.create({
      user: entry.user?.id,
      name: entry.user?.name || entry.name,
      role: entry.user?.role,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      area: areaOf(entry.path),
      action,
      detail: detail === undefined ? undefined : capped(detail),
      result,
      ...requestMeta(entry.req),
    });
  } catch (err) {
    // the log must never break the action itself
    console.error("ACTIVITY_LOG_ERROR:", err);
  }
}
