import { requirePageUser } from "@/app/lib/auth";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  await requirePageUser("manageInventory");
  return <InventoryClient />;
}
