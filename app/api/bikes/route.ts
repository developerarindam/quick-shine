// app/api/bikes/route.ts
import Bike from "@/app/models/Bike";
import ServiceEntry from "@/app/models/ServiceEntry";
import { bikeNumberRegex, fail, normalizeBikeNumber, ok, withAuth } from "@/app/lib/auth";
import { ACTIVE_STATUSES } from "@/app/lib/jobs";

// All bikes with visit stats (count, last visit, total spent), most recent first
export const GET = withAuth(null, async () => {
  const [bikes, stats] = await Promise.all([
    Bike.find().sort({ updatedAt: -1 }).lean(),
    ServiceEntry.aggregate([
      {
        $group: {
          _id: "$bikeId",
          visits: { $sum: 1 },
          lastVisit: { $max: "$createdAt" },
          spent: { $sum: "$total" },
          // jobs still in the studio (older entries without a status count as delivered)
          active: { $sum: { $cond: [{ $in: [{ $ifNull: ["$status", "delivered"] }, ACTIVE_STATUSES] }, 1, 0] } },
          due: {
            $sum: {
              $cond: [{ $eq: ["$paymentType", "due"] }, { $subtract: ["$total", { $ifNull: ["$paidAmount", 0] }] }, 0],
            },
          },
        },
      },
    ]),
  ]);

  const byBike = new Map(stats.map((s) => [String(s._id), s]));
  const data = bikes
    .map((b) => {
      const s = byBike.get(String(b._id));
      return {
        ...b,
        visits: s?.visits || 0,
        lastVisit: s?.lastVisit || null,
        spent: s?.spent || 0,
        inStudio: (s?.active || 0) > 0,
        due: Math.max(0, s?.due || 0),
      };
    })
    .sort((a, b) => {
      const at = new Date(a.lastVisit || a.updatedAt).getTime();
      const bt = new Date(b.lastVisit || b.updatedAt).getTime();
      return bt - at;
    });

  return ok(data);
});

export const POST = withAuth(null, async (req) => {
  const { bikeNumber, ownerName, phone, model, notes } = await req.json();
  if (!bikeNumber || !String(bikeNumber).trim()) return fail("Bike number is required");

  const existing = await Bike.findOne({ bikeNumber: bikeNumberRegex(bikeNumber) }).lean();
  if (existing) return fail(`Bike ${existing.bikeNumber} is already registered`, 409);

  const bike = await Bike.create({
    bikeNumber: normalizeBikeNumber(bikeNumber),
    ownerName,
    phone,
    model,
    notes,
  });

  return ok(bike);
});
