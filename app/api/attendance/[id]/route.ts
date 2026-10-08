// Super Admin corrections to a shift (times, missed sign-out, removal).
import Attendance from "@/app/models/Attendance";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { cleanBreaks, dayKey } from "@/app/lib/attendance";
import { InputError } from "@/app/lib/jobEntry";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { signIn?: ISO, signOut?: ISO | null, breaks?: [{ start: ISO, end?: ISO }], note? } */
export const PUT = withAuth<Ctx>(["ADMIN"], async (req, { params }, admin) => {
  const { id } = await params;
  const { signIn, signOut, breaks, note } = await req.json();

  const rec = await Attendance.findById(id);
  if (!rec) return fail("Entry not found", 404);

  if (signIn) {
    const inAt = new Date(signIn);
    if (Number.isNaN(inAt.getTime())) return fail("Invalid sign-in time");
    const date = dayKey(inAt);
    if (date !== rec.date && (await Attendance.exists({ _id: { $ne: id }, user: rec.user, date }))) {
      return fail(`There's already an entry for ${date}`, 409);
    }
    // keep the GPS details of the original punch, just correct the time
    rec.signIn = { ...(rec.signIn?.toObject?.() ?? rec.signIn), at: inAt };
    rec.date = date;
  }
  if (signOut === null || signOut === "") {
    rec.signOut = undefined;
  } else if (signOut) {
    const outAt = new Date(signOut);
    if (Number.isNaN(outAt.getTime())) return fail("Invalid sign-out time");
    rec.signOut = { ...(rec.signOut?.toObject?.() ?? rec.signOut ?? {}), at: outAt };
  }
  if (rec.signOut?.at && rec.signOut.at <= rec.signIn.at) return fail("Sign-out must be after sign-in");
  if (breaks !== undefined) {
    try {
      const plain = (rec.breaks || []).map((b: { toObject?: () => unknown }) => (b.toObject ? b.toObject() : b));
      rec.breaks = cleanBreaks(breaks, rec.signIn.at, rec.signOut?.at || null, plain) || [];
    } catch (e) {
      throw new InputError((e as Error).message);
    }
  } else if (rec.signOut?.at && rec.breaks?.some((b: { end?: unknown }) => !b.end)) {
    return fail("This shift has a break with no end time — add the break's end before signing out");
  }
  if (note !== undefined) rec.note = String(note).trim() || undefined;

  rec.manual = true;
  rec.editedBy = admin.id;
  rec.editedAt = new Date();
  await rec.save();
  return ok(rec);
});

export const DELETE = withAuth<Ctx>(["ADMIN"], async (_req, { params }) => {
  const { id } = await params;
  const deleted = await Attendance.findByIdAndDelete(id);
  if (!deleted) return fail("Entry not found", 404);
  return ok(null, { message: "Entry deleted" });
});
