import { requirePageUser } from "@/app/lib/auth";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  await requirePageUser(["ADMIN"]);
  return <ActivityClient />;
}
