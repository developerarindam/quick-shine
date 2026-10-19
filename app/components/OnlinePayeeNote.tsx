"use client";

import { Smartphone } from "lucide-react";
import { useApi } from "@/app/lib/api";

/** Online / UPI payments always go to one account — say whose, instead of asking. */
export function OnlinePayeeNote({ spending }: { spending?: boolean } = {}) {
  const { data } = useApi<{ onlinePayee: { _id: string; name: string } | null }>("/api/settings");
  const name = data?.onlinePayee?.name;
  return (
    <p className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
      <Smartphone className="size-4 shrink-0" />
      {name ? (
        <span>
          {spending ? "Paid online from " : "Online payment goes to "}
          <b>{name}</b>&apos;s account
        </span>
      ) : (
        <span>{spending ? "Paid online from the studio account" : "Online payment goes to the studio account"}</span>
      )}
    </p>
  );
}
