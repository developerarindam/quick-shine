import { requirePageUser } from "@/app/lib/auth";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  await requirePageUser("manageServices");
  return <ServicesClient />;
}
