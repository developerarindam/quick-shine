// Sign in / sign out at the shop. GPS must be inside the shop radius, and only
// today's shift can be punched — a missed punch can only be fixed by the Super Admin.
import Attendance from "@/app/models/Attendance";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { dayKey, insideShop, shopLocation } from "@/app/lib/attendance";

export const POST = withAuth(null, async (req, _ctx, user) => {
  const { action, lat, lng, accuracy } = await req.json();
  if (action !== "in" && action !== "out") return fail("Unknown action");

  const shop = await shopLocation();
  if (!shop) return fail("The shop location hasn't been set yet. Ask the Super Admin to set it under Attendance → Shop location.");

  const pos = { lat: Number(lat), lng: Number(lng), accuracy: Number(accuracy) || undefined };
  if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
    return fail("Your location is needed to sign in or out. Allow location access and try again.");
  }

  const { inside, distance } = insideShop(shop, pos);
  if (!inside) {
    const away = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
    return fail(`You're ${away} from the shop. You can only sign ${action} at the shop (within ${shop.radius} m).`, 403);
  }

  const now = new Date();
  const today = dayKey(now);
  const punch = { at: now, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, distance };
  const existing = await Attendance.findOne({ user: user.id, date: today });

  if (action === "in") {
    if (existing) return fail(existing.signOut ? "You've already finished today's shift" : "You're already signed in", 409);
    const rec = await Attendance.create({ user: user.id, date: today, signIn: punch });
    return ok(rec);
  }

  if (!existing) return fail("You haven't signed in today", 409);
  if (existing.signOut?.at) return fail("You've already signed out today", 409);
  existing.signOut = punch;
  await existing.save();
  return ok(existing);
});
