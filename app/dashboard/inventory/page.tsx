import { requirePageUser } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  await requirePageUser(MANAGERS);
  return <InventoryClient />;
}
