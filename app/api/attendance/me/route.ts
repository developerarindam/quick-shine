// My attendance: today's shift, the selected period, and what it has earned.
import Attendance from "@/app/models/Attendance";
import User from "@/app/models/User";
import { ok, parseRange, withAuth } from "@/app/lib/auth";
import { dayKey, shopLocation } from "@/app/lib/attendance";
import { earningsFor } from "@/app/lib/attendanceShared";

export const GET = withAuth(null, async (req, _ctx, user) => {
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const today = dayKey();

  const [records, todayRec, me, shop] = await Promise.all([
    Attendance.find({ user: user.id, date: { $gte: dayKey(from), $lte: dayKey(to) } }).sort({ date: -1 }).lean(),
    Attendance.findOne({ user: user.id, date: today }).lean(),
    User.findById(user.id).select("pay").lean(),
    shopLocation(),
  ]);

  // An earlier day left signed in — only the Super Admin can close it
  const unclosed = await Attendance.findOne({ user: user.id, date: { $lt: today }, signOut: { $exists: false } })
    .sort({ date: -1 })
    .select("date")
    .lean();

  return ok({
    today: todayRec,
    todayKey: today,
    records,
    unclosed: unclosed?.date || null,
    shop: shop ? { configured: true, radius: shop.radius, label: shop.label } : { configured: false },
    pay: me?.pay?.type ? me.pay : null,
    summary: earningsFor(records, me?.pay),
  });
});
