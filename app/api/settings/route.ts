// Studio-wide settings the app needs on every phone
import { ok, withAuth } from "@/app/lib/auth";
import { onlinePayee } from "@/app/lib/jobEntry";

export const GET = withAuth(null, async () => ok({ onlinePayee: await onlinePayee() }));
