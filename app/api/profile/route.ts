import User from "@/app/models/User";
import { fail, ok, withAuth } from "@/app/lib/auth";

// Update own name/phone, and optionally change password (requires the current one)
export const PUT = withAuth(null, async (req, _ctx, session) => {
  const { name, phone, currentPassword, newPassword } = await req.json();

  const user = await User.findById(session.id).select("+password");
  if (!user) return fail("User not found", 404);

  if (name !== undefined) {
    if (!String(name).trim()) return fail("Name is required");
    user.name = String(name).trim();
  }
  if (phone !== undefined) user.phone = String(phone).trim();

  if (newPassword) {
    if (String(newPassword).length < 6) return fail("New password must be at least 6 characters");
    if (!currentPassword || !(await user.comparePassword(currentPassword))) {
      return fail("Current password is incorrect");
    }
    user.password = newPassword;
  }

  await user.save();
  return ok({ id: String(user._id), name: user.name, email: user.email, phone: user.phone, role: user.role });
});
