"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { homePath } from "@/lib/auth";
import { useStoredSession } from "@/lib/session";

/**
 * Header links on public pages. A stored session only changes the link's destination;
 * the dashboard it opens verifies the session before showing anything.
 */
export function PublicHeaderActions() {
  const session = useStoredSession();

  if (session) {
    return (
      <Link href={homePath(session.user.role)} className={buttonClasses("primary")}>
        Open dashboard
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className={buttonClasses("secondary")}>
        Log in
      </Link>
      <Link href="/signup" className={buttonClasses("primary")}>
        Sign up
      </Link>
    </>
  );
}
