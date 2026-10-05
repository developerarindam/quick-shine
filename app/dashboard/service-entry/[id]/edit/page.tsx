import { requirePageUser } from "@/app/lib/auth";
import EditJobClient from "./EditJobClient";

// Correcting past jobs (dates, services, payments) is reserved for the Super Admin
export default async function EditJobPage() {
  await requirePageUser(["ADMIN"]);
  return <EditJobClient />;
}
