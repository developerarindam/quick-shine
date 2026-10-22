// Server side: the permission matrix the Super Admin saved (Settings → "permissions").
import { getSetting, setSetting } from "@/app/models/Setting";
import { PERMISSIONS, defaultPermMatrix, type PermMatrix, type PermRole } from "@/app/lib/roles";

const KEY = "permissions";
const TTL_MS = 30_000;
let cache: { value: PermMatrix; expires: number } | null = null;

export async function getPermMatrix(): Promise<PermMatrix> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const saved = await getSetting<Partial<PermMatrix>>(KEY);
  const base = defaultPermMatrix();
  const value: PermMatrix = {
    MANAGER: { ...base.MANAGER, ...(saved?.MANAGER || {}) },
    USER: { ...base.USER, ...(saved?.USER || {}) },
  };
  cache = { value, expires: Date.now() + TTL_MS };
  return value;
}

/** Saves only known keys as booleans; returns the full matrix. */
export async function savePermMatrix(input: unknown): Promise<PermMatrix> {
  const src = (input || {}) as Partial<Record<PermRole, Record<string, unknown>>>;
  const base = await getPermMatrix();
  const clean = (role: PermRole) =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.key, typeof src[role]?.[p.key] === "boolean" ? (src[role]![p.key] as boolean) : base[role][p.key]]));
  const value = { MANAGER: clean("MANAGER"), USER: clean("USER") } as PermMatrix;
  await setSetting(KEY, value);
  cache = { value, expires: Date.now() + TTL_MS };
  return value;
}
