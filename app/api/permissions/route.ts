// What Admins and Staff may do — Super Admin only
import { clearSessionCache, ok, withAuth } from "@/app/lib/auth";
import { getPermMatrix, savePermMatrix } from "@/app/lib/permissions";
import { defaultPermMatrix } from "@/app/lib/roles";

export const GET = withAuth(["ADMIN"], async () => ok({ matrix: await getPermMatrix(), defaults: defaultPermMatrix() }));

/** { matrix: { MANAGER: {...}, USER: {...} } } or { reset: true } */
export const PUT = withAuth(["ADMIN"], async (req) => {
  const body = await req.json();
  const matrix = await savePermMatrix(body.reset ? defaultPermMatrix() : body.matrix);
  // everyone's next request picks up the new permissions
  clearSessionCache();
  return ok({ matrix, defaults: defaultPermMatrix() });
});
