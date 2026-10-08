// Shop location for GPS sign-in. Viewing: Super Admin / Admin. Setting: Super Admin only.
import { fail, ok, withAuth } from "@/app/lib/auth";
import { DEFAULT_RADIUS_M, shopLocation, type ShopLocation } from "@/app/lib/attendance";
import { setSetting } from "@/app/models/Setting";
import { MANAGERS } from "@/app/lib/roles";

export const GET = withAuth(MANAGERS, async () => ok(await shopLocation()));

export const PUT = withAuth(["ADMIN"], async (req) => {
  const { lat, lng, radius, label } = await req.json();
  const value: ShopLocation = {
    lat: Number(lat),
    lng: Number(lng),
    radius: Math.round(Number(radius) || DEFAULT_RADIUS_M),
    label: label?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng) || Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) {
    return fail("Location coordinates look wrong");
  }
  if (value.radius < 20 || value.radius > 2000) return fail("Radius should be between 20 m and 2000 m");
  await setSetting("attendance.location", value);
  return ok(value);
});
