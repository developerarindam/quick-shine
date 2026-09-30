import { requirePageUser } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  await requirePageUser(MANAGERS);
  return <ServicesClient />;
}
