"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** "Staff login" on the public page — becomes "Open dashboard" when already signed in. */
export default function StaffLoginButton() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // the page itself is cached for everyone, so ask the server who this visitor is
    fetch("/api/getUser", { cache: "no-store" })
      .then((r) => setSignedIn(r.ok))
      .catch(() => {});
  }, []);

  return (
    <Link
      href={signedIn ? "/dashboard" : "/login"}
      className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
    >
      {signedIn ? "Open dashboard" : "Staff login"}
    </Link>
  );
}
