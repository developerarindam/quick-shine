import { requirePageUser } from "@/app/lib/auth";
import { MANAGERS } from "@/app/lib/roles";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  await requirePageUser(MANAGERS);
  return <ExpensesClient />;
}
