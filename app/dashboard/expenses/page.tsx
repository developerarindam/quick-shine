import { requirePageUser } from "@/app/lib/auth";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  await requirePageUser();
  return <ExpensesClient />;
}
