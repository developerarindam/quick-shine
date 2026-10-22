import { requirePageUser } from "@/app/lib/auth";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  await requirePageUser("viewReports");
  return <ReportsClient />;
}
