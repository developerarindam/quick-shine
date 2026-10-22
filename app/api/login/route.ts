import { NextResponse, after } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";
import LoginAttempt from "@/app/models/LoginAttempt";
import { errorResponse, fail, setSessionCookie, signSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/activity";
import type { Role } from "@/app/lib/roles";

// Wrong passwords allowed per window before that email (or device IP) is locked out for a while
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

async function lockedFor(keys: { id: string; max: number }[]) {
  const docs = await LoginAttempt.find({ _id: { $in: keys.map((k) => k.id) } }).lean<{ _id: string; count: number; expiresAt: Date }[]>();
  const hit = docs.find((d) => d.count >= (keys.find((k) => k.id === d._id)?.max ?? Infinity) && d.expiresAt > new Date());
  return hit ? Math.max(1, Math.ceil((hit.expiresAt.getTime() - Date.now()) / 60_000)) : 0;
}

async function recordFailure(ids: string[]) {
  const expiresAt = new Date(Date.now() + WINDOW_MS);
  await Promise.all(
    ids.map((id) => LoginAttempt.updateOne({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true }))
  );
}

/**
 * { email, password }                → sets the session cookie (web)
 * { email, password, client: "app" } → also returns the token, for a mobile app to send as
 *                                      `Authorization: Bearer <token>`
 */
export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, password, client } = await req.json();

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return fail("Enter your email and password");
    }

    const address = email.toLowerCase().trim();
    const keys = [
      { id: `email:${address}`, max: MAX_PER_EMAIL },
      { id: `ip:${clientIp(req)}`, max: MAX_PER_IP },
    ];
    const note = (status: number, action: string, user?: { _id: unknown; name: string; role: string } | null) =>
      after(() =>
        logActivity({
          user: user ? { id: String(user._id), name: user.name, role: user.role as Role } : null,
          name: user ? undefined : address,
          method: "LOGIN",
          path: "/api/login",
          status,
          action,
          detail: { email: address, client: client === "app" ? "app" : "web" },
          req,
        })
      );

    const wait = await lockedFor(keys);
    if (wait) note(429, "login_locked");
    if (wait) return fail(`Too many wrong attempts. Try again in ${wait} minute${wait > 1 ? "s" : ""}.`, 429);

    const user = await User.findOne({ email: address }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      await recordFailure(keys.map((k) => k.id));
      note(401, "login_failed", user);
      return fail("Invalid email or password", 401);
    }

    if (user.status !== "Active") {
      note(403, "login_disabled", user);
      return fail("Your account is disabled. Contact the studio owner.", 403);
    }

    await LoginAttempt.deleteOne({ _id: keys[0].id });
    note(200, "login", user);
    const token = signSession(user);
    const response = NextResponse.json(
      { success: true, message: "Login successful", ...(client === "app" ? { token } : {}) },
      { status: 200 }
    );
    return setSessionCookie(response, token);
  } catch (err) {
    return errorResponse(err);
  }
}
