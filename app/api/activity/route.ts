// Activity log — Super Admin only.
// ?from=&to=  date range · ?user=<id> · ?area=jobs|money|team|stock|attendance|signin|settings
// ?before=<ISO date> loads the next (older) page
import { Types } from "mongoose";
import ActivityLog from "@/app/models/ActivityLog";
import { ok, parseRange, withAuth } from "@/app/lib/auth";

const PAGE = 100;

export const GET = withAuth(["ADMIN"], async (req) => {
  const params = new URL(req.url).searchParams;
  const { from, to } = parseRange(params);
  const before = params.get("before");
  const at: Record<string, Date> = { $gte: from, $lte: to };
  if (before && !Number.isNaN(new Date(before).getTime())) at.$lt = new Date(before);

  const filter: Record<string, unknown> = { at };
  const user = params.get("user");
  if (user && Types.ObjectId.isValid(user)) filter.user = user;
  const area = params.get("area");
  if (area) filter.area = area;

  const rows = await ActivityLog.find(filter).sort({ at: -1 }).limit(PAGE + 1).lean();
  return ok({ rows: rows.slice(0, PAGE), more: rows.length > PAGE });
});
