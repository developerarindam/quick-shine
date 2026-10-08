// Team attendance. Super Admin / Admin can view; only the Super Admin can add entries.
import Attendance from "@/app/models/Attendance";
import User from "@/app/models/User";
import { fail, ok, parseRange, withAuth } from "@/app/lib/auth";
import { dayKey } from "@/app/lib/attendance";
import { MANAGERS } from "@/app/lib/roles";

export const GET = withAuth(MANAGERS, async (req) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const today = dayKey();

  const [records, team, todays] = await Promise.all([
    Attendance.find({ date: { $gte: dayKey(from), $lte: dayKey(to) } })
      .populate("user", "name role")
      .populate("editedBy", "name")
      .sort({ date: -1, "signIn.at": 1 })
      .lean(),
    User.find({ status: "Active" }).select("name role").sort({ name: 1 }).lean(),
    Attendance.find({ date: today }).lean(),
  ]);

  const byUser = new Map(todays.map((r) => [String(r.user), r]));
  return ok({
    todayKey: today,
    records,
    board: team.map((u) => ({ user: u, today: byUser.get(String(u._id)) || null })),
  });
});

/** Super Admin: add a missed shift. Body: { userId, signIn: ISO, signOut?: ISO, note? } */
export const POST = withAuth(["ADMIN"], async (req, _ctx, admin) => {
  const { userId, signIn, signOut, note } = await req.json();
  const inAt = new Date(signIn);
  const outAt = signOut ? new Date(signOut) : null;
  if (!userId || Number.isNaN(inAt.getTime())) return fail("Choose the employee and sign-in time");
  if (outAt && (Number.isNaN(outAt.getTime()) || outAt <= inAt)) return fail("Sign-out must be after sign-in");
  if (inAt.getTime() > Date.now() + 5 * 60_000) return fail("Sign-in can't be in the future");
  if (!(await User.exists({ _id: userId }))) return fail("Employee not found", 404);

  const date = dayKey(inAt);
  if (await Attendance.exists({ user: userId, date })) return fail(`There's already an entry for ${date} — edit that one instead`, 409);

  const rec = await Attendance.create({
    user: userId,
    date,
    signIn: { at: inAt },
    ...(outAt ? { signOut: { at: outAt } } : {}),
    manual: true,
    editedBy: admin.id,
    editedAt: new Date(),
    note: note?.trim() || undefined,
  });
  return ok(rec);
});
