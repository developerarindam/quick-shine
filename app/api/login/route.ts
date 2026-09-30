import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";
import jwt from "jsonwebtoken";
import { errorResponse, fail } from "@/app/lib/auth";

const SESSION_DAYS = 30;

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    if (!email || !password) {
      return fail("Enter your email and password");
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return fail("Invalid email or password", 401);
    }

    if (user.status !== "Active") {
      return fail("Your account is disabled. Contact the studio owner.", 403);
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: `${SESSION_DAYS}d` }
    );

    const response = NextResponse.json(
      { success: true, message: "Login successful" },
      { status: 200 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // lax so links opened from WhatsApp/SMS keep the session
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
