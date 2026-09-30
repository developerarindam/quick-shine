import { ok, withAuth } from "@/app/lib/auth";

export const GET = withAuth(null, async (_req, _ctx, user) => ok(user));
