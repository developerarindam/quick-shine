import User from "@/app/models/User";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { ROLES, type Role } from "@/app/lib/roles";

// ?lite=1 → active team members (id, name, role) for any signed-in user, e.g. to assign jobs.
// Full list is owner-only.
export const GET = withAuth(null, async (req, _ctx, user) => {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("lite")) {
    const team = await User.find({ status: "Active" }).select("name role").sort({ name: 1 }).lean();
    return ok(team);
  }

  if (user.role !== "ADMIN") return fail("You don't have permission to do this", 403);

  const users = await User.find().sort({ createdAt: 1 }).lean();
  return ok(users);
});

export const POST = withAuth(["ADMIN"], async (req) => {
  const { name, email, phone, password, role, status } = await req.json();

  if (!name || !email || !password) return fail("Name, email and password are required");
  if (String(password).length < 6) return fail("Password must be at least 6 characters");
  if (role && !ROLES.includes(role as Role)) return fail("Invalid role");

  const exists = await User.exists({ email: String(email).toLowerCase().trim() });
  if (exists) return fail("A user with this email already exists", 409);

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: role || "USER",
    status: status || "Active",
  });

  const safe = user.toObject() as unknown as Record<string, unknown>;
  delete safe.password;
  return ok(safe);
});
