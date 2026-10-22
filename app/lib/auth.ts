import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, after } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";
import { allowed, resolvePerms, type PermKey, type Role, type SessionUser } from "@/app/lib/roles";
import { getPermMatrix } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/activity";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_ALGORITHM = "HS256" as const;
export const SESSION_DAYS = 7;

/** Signs a session token. `v` must match the user's tokenVersion for the token to stay valid. */
export function signSession(user: { _id: unknown; role: string; tokenVersion?: number }) {
  return jwt.sign({ id: String(user._id), role: user.role, v: user.tokenVersion || 0 }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: `${SESSION_DAYS}d`,
  });
}

export function verifySession(token: string): { id?: string; v?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as { id?: string; v?: number };
  } catch {
    return null;
  }
}

/** Sets the httpOnly session cookie on a response. */
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // lax so links opened from WhatsApp/SMS keep the session
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

// Short-lived per-instance cache so each API call doesn't wait on a user lookup first.
// Role / status changes take effect within SESSION_TTL_MS (and immediately on the instance
// that made them, via clearSessionCache).
const SESSION_TTL_MS = 30_000;
const sessionCache = new Map<string, { user: SessionUser; expires: number }>();

export function clearSessionCache() {
  sessionCache.clear();
}

/**
 * Where the session token came from: the browser cookie, or an
 * `Authorization: Bearer <token>` header (for a mobile app).
 */
async function readToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get("token")?.value || null;
}

/** Reads the session token and loads the (active) user from the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readToken();
  if (!token) return null;

  const decoded = verifySession(token);
  if (!decoded?.id) return null;

  const hit = sessionCache.get(token);
  if (hit && hit.expires > Date.now()) return hit.user;

  await dbConnect();
  const user = await User.findById(decoded.id).lean();
  // tokenVersion moves on when the password / role changes or the account is disabled
  if (!user || user.status !== "Active" || (user.tokenVersion || 0) !== (decoded.v || 0)) {
    sessionCache.delete(token);
    return null;
  }

  const session: SessionUser = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    perms: resolvePerms(user.role, await getPermMatrix()),
  };
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(token, { user: session, expires: Date.now() + SESSION_TTL_MS });
  return session;
}

/** For server pages: redirects away when not signed in or not allowed (by role or permission). */
export async function requirePageUser(access?: Role[] | PermKey): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (Array.isArray(access) && !access.includes(user.role)) redirect("/dashboard");
  if (typeof access === "string" && !allowed(user, access)) redirect("/dashboard");
  return user;
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export function ok(data?: unknown, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...extra });
}

type Handler<C> = (req: Request, ctx: C, user: SessionUser) => Promise<Response>;

/**
 * Wraps an API route: connects to the DB, checks the session and role (or a permission
 * the Super Admin controls), records changes in the activity log, and turns thrown
 * errors into JSON responses.
 */
export function withAuth<C = unknown>(access: Role[] | PermKey | null, handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (!(await sameOrigin(req))) return fail("Request blocked", 403);
      await dbConnect();
      const user = await getSessionUser();
      if (!user) return fail("Please sign in again", 401);

      const changes = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      const body = changes ? await req.clone().text().catch(() => "") : "";
      const record = (res: Response) => {
        if (!changes) return res;
        const copy = res.clone();
        after(async () =>
          logActivity({ user, method: req.method, path: new URL(req.url).pathname, status: res.status, detail: body, responseBody: await copy.text(), req })
        );
        return res;
      };

      const denied =
        (Array.isArray(access) && !access.includes(user.role)) || (typeof access === "string" && !allowed(user, access));
      if (denied) return record(fail("You don't have permission to do this", 403));
      return record(await handler(req, ctx, user));
    } catch (err: unknown) {
      return errorResponse(err);
    }
  };
}

/**
 * CSRF guard for cookie sessions: a state-changing request must come from this site.
 * (Bearer-token clients such as a mobile app don't send cookies, so they aren't affected.)
 */
async function sameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return true;
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorResponse(err: unknown) {
  const e = err as { name?: string; code?: number; message?: string; errors?: Record<string, { message: string }> };
  if (e?.code === 11000) return fail("This record already exists", 409);
  if (e?.name === "ValidationError" && e.errors) {
    const first = Object.values(e.errors)[0];
    return fail(first?.message || "Invalid data", 400);
  }
  if (e?.name === "CastError") return fail("Invalid id", 400);
  if (e?.name === "InputError") return fail(e.message || "Invalid data", 400);
  console.error("API_ERROR:", err);
  // internal details stay in the server log
  return fail("Something went wrong — please try again", 500);
}

/** Parses ?from=&to= (ISO timestamps from the client's local day). Defaults to the server's today. */
export function parseRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = toParam ? new Date(toParam) : new Date(new Date().setHours(23, 59, 59, 999));
  return { from, to };
}

/** Matches a bike number regardless of spaces, dashes and case: "wb 02-ab1234" ≈ "WB02AB1234". */
export function bikeNumberRegex(bikeNumber: string) {
  const chars = bikeNumber.toUpperCase().replace(/[^A-Z0-9]/g, "").split("");
  return new RegExp(`^[\\s-]*${chars.join("[\\s-]*")}[\\s-]*$`, "i");
}

export function normalizeBikeNumber(bikeNumber: string) {
  return bikeNumber.toUpperCase().replace(/\s+/g, " ").trim();
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
