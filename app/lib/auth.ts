import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";
import type { Role, SessionUser } from "@/app/lib/roles";

const JWT_SECRET = process.env.JWT_SECRET as string;

/** Reads the session cookie and loads the (active) user from the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  let decoded: { id?: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
  } catch {
    return null;
  }
  if (!decoded.id) return null;

  await dbConnect();
  const user = await User.findById(decoded.id).lean();
  if (!user || user.status !== "Active") return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

/** For server pages: redirects away when not signed in or not allowed. */
export async function requirePageUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
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
 * Wraps an API route: connects to the DB, checks the session and role,
 * and turns thrown errors into JSON responses.
 */
export function withAuth<C = unknown>(roles: Role[] | null, handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      await dbConnect();
      const user = await getSessionUser();
      if (!user) return fail("Please sign in again", 401);
      if (roles && !roles.includes(user.role)) {
        return fail("You don't have permission to do this", 403);
      }
      return await handler(req, ctx, user);
    } catch (err: unknown) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  const e = err as { name?: string; code?: number; message?: string; errors?: Record<string, { message: string }> };
  if (e?.code === 11000) return fail("This record already exists", 409);
  if (e?.name === "ValidationError" && e.errors) {
    const first = Object.values(e.errors)[0];
    return fail(first?.message || "Invalid data", 400);
  }
  if (e?.name === "CastError") return fail("Invalid id", 400);
  console.error("API_ERROR:", err);
  return fail(e?.message || "Something went wrong", 500);
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
