// Server-side attendance: studio day, shop geofence.
import { getSetting } from "@/app/models/Setting";

export const STUDIO_TZ = process.env.STUDIO_TZ || "Asia/Kolkata";

/** yyyy-mm-dd of `d` in the studio's timezone. */
export function dayKey(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type ShopLocation = { lat: number; lng: number; radius: number; label?: string; updatedAt?: string };

export const DEFAULT_RADIUS_M = 100;

export async function shopLocation(): Promise<ShopLocation | null> {
  return getSetting<ShopLocation>("attendance.location");
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Is the phone at the shop? Allows for GPS error up to 50 m, so a correct phone standing
 * in the shop isn't rejected by a jumpy reading — but someone at home always is.
 */
export function insideShop(shop: ShopLocation, pos: { lat: number; lng: number; accuracy?: number }) {
  const distance = Math.round(distanceM(shop, pos));
  const slack = Math.min(Math.max(pos.accuracy || 0, 0), 50);
  return { inside: distance - slack <= shop.radius, distance };
}

/**
 * Validate breaks sent by the Super Admin: [{ start: ISO, end?: ISO }].
 * Each must sit inside the shift, end after it starts, and not overlap the next.
 * Returns them sorted, or throws a message for the user.
 */
export function cleanBreaks(raw: unknown, signIn: Date, signOut: Date | null, existing: { start: { at: Date }; end?: { at: Date } }[] = []) {
  if (!Array.isArray(raw)) return null;
  const list = raw.map((b, i) => {
    const start = new Date(b?.start);
    const end = b?.end ? new Date(b.end) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) throw new Error(`Break ${i + 1} has an invalid time`);
    if (end && end <= start) throw new Error(`Break ${i + 1} must end after it starts`);
    if (start < signIn) throw new Error(`Break ${i + 1} starts before sign-in`);
    if (signOut && (start >= signOut || (end && end > signOut))) throw new Error(`Break ${i + 1} must be before sign-out`);
    if (signOut && !end) throw new Error(`Break ${i + 1} needs an end time (the shift is signed out)`);
    // keep the GPS details of punches whose time didn't change
    const same = existing.find((e) => e.start.at.getTime() === start.getTime());
    return {
      start: same ? { ...same.start, at: start } : { at: start },
      ...(end ? { end: same?.end && same.end.at.getTime() === end.getTime() ? same.end : { at: end } } : {}),
    };
  });
  list.sort((a, b) => a.start.at.getTime() - b.start.at.getTime());
  for (let i = 1; i < list.length; i++) {
    const prevEnd = list[i - 1].end?.at;
    if (!prevEnd || prevEnd > list[i].start.at) throw new Error("Breaks overlap — check the times");
  }
  return list;
}
