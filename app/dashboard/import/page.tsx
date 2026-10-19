import { requirePageUser } from "@/app/lib/auth";
import ImportClient from "./ImportClient";

// Bringing in old data from sheets is reserved for the Super Admin
export default async function ImportPage() {
  await requirePageUser(["ADMIN"]);
  return <ImportClient />;
}
