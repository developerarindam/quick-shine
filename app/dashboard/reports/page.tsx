import { requirePageUser } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  await requirePageUser(MANAGERS);
  return <ReportsClient />;
}
