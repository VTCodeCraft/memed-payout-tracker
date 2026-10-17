"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { homePath } from "@/lib/auth";
import { useStoredSession } from "@/lib/session";

/**
 * The landing page's call to action: sign up when signed out, or back to the dashboard
 * when a session is stored (the dashboard verifies it before showing anything).
 */
export function StartLinks() {
  const session = useStoredSession();

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {session ? (
        <Link href={homePath(session.user.role)} className={buttonClasses("primary")}>
          Open your dashboard
        </Link>
      ) : (
        <Link href="/signup" className={buttonClasses("primary")}>
          Get started
        </Link>
      )}
      <a href="#how-payouts-work" className="font-semibold underline underline-offset-4 transition-colors hover:text-brand">
        How payouts work
      </a>
    </div>
  );
}
