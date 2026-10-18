"use client";

import { useSearchParams } from "next/navigation";
import { Notice } from "@/components/alert";

/** Tells a visitor sent here by a rejected token (EXPIRED_LOGIN_PATH) why they must log in again. */
export function SessionEndedNotice() {
  const params = useSearchParams();
  if (params.get("session") !== "expired") return null;

  return (
    <Notice tone="info" className="mt-6">
      Your session has ended. Log in again to continue.
    </Notice>
  );
}
