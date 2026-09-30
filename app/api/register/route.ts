// First-run setup: creates the owner (ADMIN) account. Closed once any user exists —
// after that, staff accounts are created by the owner from the Users screen.
import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";
import { errorResponse, fail } from "@/app/lib/auth";

export async function GET() {
  try {
    await dbConnect();
    const count = await User.estimatedDocumentCount();
    return NextResponse.json({ success: true, data: { needsSetup: count === 0 } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();

    if ((await User.countDocuments()) > 0) {
      return fail("Setup is already complete. Ask the owner to create your account.", 403);
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return fail("All fields are required");
    }
    if (String(password).length < 6) {
      return fail("Password must be at least 6 characters");
    }

    await User.create({ name, email, password, role: "ADMIN", status: "Active" });

    return NextResponse.json(
      { success: true, message: "Owner account created" },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
