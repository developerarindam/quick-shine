import User from "@/app/models/User";
import ServiceEntry from "@/app/models/ServiceEntry";
import { clearSessionCache, fail, ok, withAuth } from "@/app/lib/auth";
import { ROLES, type Role } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withAuth<Ctx>(["ADMIN"], async (req, { params }, session) => {
  const { id } = await params;
  const { name, email, phone, password, role, status } = await req.json();

  const user = await User.findById(id).select("+password");
  if (!user) return fail("User not found", 404);

  const isSelf = String(user._id) === session.id;
  if (isSelf && role && role !== "ADMIN") return fail("You can't remove your own owner access");
  if (isSelf && status === "Inactive") return fail("You can't disable your own account");
  if (role && !ROLES.includes(role as Role)) return fail("Invalid role");

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (role) user.role = role;
  if (status) user.status = status;
  if (password) {
    if (String(password).length < 6) return fail("Password must be at least 6 characters");
    user.password = password; // hashed by the pre-save hook
  }

  await user.save();
  clearSessionCache();
  const safe = user.toObject() as unknown as Record<string, unknown>;
  delete safe.password;
  return ok(safe);
});

export const DELETE = withAuth<Ctx>(["ADMIN"], async (_req, { params }, session) => {
  const { id } = await params;
  if (id === session.id) return fail("You can't delete your own account");

  const hasJobs = await ServiceEntry.exists({ $or: [{ createdBy: id }, { assignedTo: id }] });
  if (hasJobs) {
    // Keep history intact — disable instead of deleting
    await User.findByIdAndUpdate(id, { status: "Inactive" });
    clearSessionCache();
    return ok(null, { message: "User has job history, so the account was disabled instead" });
  }

  const deleted = await User.findByIdAndDelete(id);
  clearSessionCache();
  if (!deleted) return fail("User not found", 404);
  return ok(null, { message: "User deleted" });
});
