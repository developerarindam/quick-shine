import AppShell from "@/app/components/AppShell";
import { requirePageUser } from "@/app/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageUser();

  return <AppShell user={user}>{children}</AppShell>;
}
