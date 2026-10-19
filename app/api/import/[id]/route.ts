// Undo an import: removes its jobs, and the bikes it created that have no other jobs.
import Bike from "@/app/models/Bike";
import ServiceEntry from "@/app/models/ServiceEntry";
import ImportBatch from "@/app/models/ImportBatch";
import { fail, ok, withAuth } from "@/app/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(["ADMIN"], async (_req, { params }) => {
  const { id } = await params;
  const batch = await ImportBatch.findById(id);
  if (!batch) return fail("Import not found", 404);
  if (batch.undoneAt) return fail("This import was already undone", 409);

  const jobs = await ServiceEntry.deleteMany({ importBatch: id });
  const created = await Bike.find({ importBatch: id }).select("_id").lean();
  let bikesRemoved = 0;
  for (const b of created) {
    if (!(await ServiceEntry.exists({ bikeId: b._id }))) {
      await Bike.deleteOne({ _id: b._id });
      bikesRemoved++;
    }
  }
  batch.undoneAt = new Date();
  await batch.save();
  return ok({ jobsRemoved: jobs.deletedCount, bikesRemoved });
});
