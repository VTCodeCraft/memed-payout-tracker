"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { homePath } from "@/lib/auth";
import { useStoredSession } from "@/lib/session";

/**
 * Shows login and signup only to signed-out visitors. When a session exists, whether it
 * was just created by the form or kept from an earlier visit, it opens that role's home
 * instead; the home page verifies the session, so a stale one cannot cause a loop.
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const session = useStoredSession();
  const router = useRouter();
  const home = session ? homePath(session.user.role) : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  if (home) {
    return (
      <p role="status" className="py-12 text-center text-muted">
        Opening your dashboard…
      </p>
    );
  }
  return children;
}
