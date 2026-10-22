import { NextResponse, after } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import { getSessionUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/activity";

export async function POST(req: Request) {
  const response = NextResponse.json(
    { success: true, message: "Logout successful" },
    { status: 200 }
  );

  try {
    await dbConnect();
    const user = await getSessionUser();
    if (user) after(() => logActivity({ user, method: "LOGOUT", path: "/api/logout", status: 200, action: "logout", req }));
  } catch {
    // signing out must always work
  }

  // 🔥 Clear the cookie
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0), // ✅ Expire immediately
  });

  return response;
}
