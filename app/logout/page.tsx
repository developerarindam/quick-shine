"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Clean up tokens stored by older versions of the app
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    fetch("/api/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
      router.refresh();
    });
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-linear-to-br from-brand-600 to-brand-900 text-white">
      <Loader2 className="size-8 animate-spin" />
      <p className="font-medium">Signing you out…</p>
    </div>
  );
}
