import Service from "@/app/models/Service";
import ServiceEntry from "@/app/models/ServiceEntry";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

function cleanConsumes(list: { item?: string; qty?: number | string }[]) {
  return list.filter((c) => c.item && Number(c.qty) > 0).map((c) => ({ item: c.item, qty: Number(c.qty) }));
}

const FIELDS = ["name", "price", "category", "description", "duration", "sortOrder", "isActive"] as const;

export const PUT = withAuth<Ctx>(MANAGERS, async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();

  const service = await Service.findById(id);
  if (!service) return fail("Service not found", 404);

  for (const key of FIELDS) {
    if (body[key] === undefined) continue;
    service[key] = ["price", "duration", "sortOrder"].includes(key)
      ? body[key] === "" ? undefined : Number(body[key])
      : body[key];
  }

  if (Array.isArray(body.consumes)) service.consumes = cleanConsumes(body.consumes);

  await service.save();
  return ok(service);
});

export const DELETE = withAuth<Ctx>(MANAGERS, async (_req, { params }) => {
  const { id } = await params;

  // Services used in past jobs are archived so old bills keep their line items
  const used = await ServiceEntry.exists({ "services.serviceId": id });
  if (used) {
    await Service.findByIdAndUpdate(id, { isActive: false });
    return ok(null, { message: "Service is used in past jobs, so it was deactivated instead" });
  }

  const deleted = await Service.findByIdAndDelete(id);
  if (!deleted) return fail("Service not found", 404);
  return ok(null, { message: "Service deleted" });
});
