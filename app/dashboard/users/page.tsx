import { requirePageUser } from "@/app/lib/auth";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  await requirePageUser(["ADMIN"]);
  return <UsersClient />;
}
