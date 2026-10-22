import { requirePageUser } from "@/app/lib/auth";
import PermissionsClient from "./PermissionsClient";

export default async function PermissionsPage() {
  await requirePageUser(["ADMIN"]);
  return <PermissionsClient />;
}
