"use client";

import { useSearchParams } from "next/navigation";

/** Tells a visitor sent here by a rejected token (EXPIRED_LOGIN_PATH) why they must log in again. */
export function SessionEndedNotice() {
  const params = useSearchParams();
  if (params.get("session") !== "expired") return null;

  return (
    <p role="status" className="mt-6 rounded-2xl border border-ink bg-lime px-4 py-3 text-sm font-medium">
      Your session has ended. Log in again to continue.
    </p>
  );
}
