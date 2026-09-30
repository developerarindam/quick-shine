import Service from "@/app/models/Service";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";

// Active services by default; ?all=1 includes inactive ones (catalog management)
export const GET = withAuth(null, async (req) => {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("all") ? {} : { isActive: true };
  const services = await Service.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return ok(services);
});

export const POST = withAuth(MANAGERS, async (req) => {
  const body = await req.json();
  if (!body.name || !String(body.name).trim()) return fail("Service name is required");
  if (body.price === undefined || body.price === "" || Number(body.price) < 0) return fail("Enter a valid price");

  const service = await Service.create({
    name: body.name,
    price: Number(body.price),
    category: body.category || "basic",
    description: body.description,
    duration: body.duration ? Number(body.duration) : undefined,
    sortOrder: Number(body.sortOrder) || 0,
    isActive: body.isActive ?? true,
    consumes: Array.isArray(body.consumes)
      ? body.consumes
          .filter((c: { item?: string; qty?: number }) => c.item && Number(c.qty) > 0)
          .map((c: { item: string; qty: number }) => ({ item: c.item, qty: Number(c.qty) }))
      : [],
  });

  return ok(service);
});
