import { Bike as BikeIcon, Crown, Sparkles, Star } from "lucide-react";

// Card header colours, picked from the bike number so a bike keeps its colour
export const ACCENTS = [
  "from-brand-600 to-brand-800",
  "from-sky-500 to-brand-700",
  "from-violet-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-700",
];
export const accentFor = (s: string) => ACCENTS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ACCENTS.length];

export function customerTier(visits = 0) {
  if (visits >= 5) return { label: "VIP", icon: Crown, cls: "bg-amber-400/90 text-amber-950" };
  if (visits >= 3) return { label: "Regular", icon: Star, cls: "bg-white/90 text-brand-700" };
  if (visits >= 1) return { label: visits === 1 ? "New" : "Returning", icon: Sparkles, cls: "bg-white/90 text-slate-700" };
  return { label: "Registered", icon: BikeIcon, cls: "bg-white/80 text-slate-600" };
}
