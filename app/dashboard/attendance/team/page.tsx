import { requirePageUser } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import TeamAttendanceClient from "./TeamAttendanceClient";

// Viewing: Super Admin / Admin. Corrections, payroll and shop location: Super Admin (enforced by the APIs too).
export default async function TeamAttendancePage() {
  await requirePageUser(MANAGERS);
  return <TeamAttendanceClient />;
}
