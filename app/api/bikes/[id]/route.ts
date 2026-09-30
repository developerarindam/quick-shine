import Bike from "@/app/models/Bike";
import ServiceEntry, { hydrateJobs } from "@/app/models/ServiceEntry";
import "@/app/models/User";
import "@/app/models/Service";
import { bikeNumberRegex, fail, normalizeBikeNumber, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

// Bike with its full job history (services, payments, staff, status dates)
export const GET = withAuth<Ctx>(null, async (_req, { params }) => {
  const { id } = await params;
  const [bike, jobs] = await Promise.all([
    Bike.findById(id).lean(),
    ServiceEntry.find({ bikeId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!bike) return fail("Bike not found", 404);

  return ok({ bike, jobs: await hydrateJobs(jobs) });
});

export const PUT = withAuth<Ctx>(null, async (req, { params }) => {
  const { id } = await params;
  const { bikeNumber, ownerName, phone, model, notes } = await req.json();

  const bike = await Bike.findById(id);
  if (!bike) return fail("Bike not found", 404);

  if (bikeNumber !== undefined) {
    if (!String(bikeNumber).trim()) return fail("Bike number is required");
    const clash = await Bike.findOne({ _id: { $ne: id }, bikeNumber: bikeNumberRegex(bikeNumber) }).lean();
    if (clash) return fail(`Bike ${clash.bikeNumber} is already registered`, 409);
    bike.bikeNumber = normalizeBikeNumber(bikeNumber);
  }
  if (ownerName !== undefined) bike.ownerName = ownerName;
  if (phone !== undefined) bike.phone = phone;
  if (model !== undefined) bike.model = model;
  if (notes !== undefined) bike.notes = notes;

  await bike.save();
  return ok(bike);
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }) => {
  const { id } = await params;

  const jobCount = await ServiceEntry.countDocuments({ bikeId: id });
  if (jobCount > 0) {
    return fail(`This bike has ${jobCount} job(s) on record. Delete those jobs first.`, 409);
  }

  const bike = await Bike.findByIdAndDelete(id);
  if (!bike) return fail("Bike not found", 404);
  return ok(null, { message: "Bike deleted" });
});
