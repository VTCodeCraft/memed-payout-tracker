"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Alert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { NavLink } from "@/components/nav-link";
import { ApiError } from "@/lib/api-client";
import { homePath } from "@/lib/auth";
import { type SessionCheck, decideAccess } from "@/lib/route-guard";
import { type Role, clearSession, getSession, useStoredSession, verifySession } from "@/lib/session";
import { SignedInContext } from "@/lib/signed-in";
import { useSlowRequest } from "@/lib/use-slow-request";

/**
 * Frame for one role's pages. It verifies the stored token with /auth/me once per page
 * load, shows nothing protected until that succeeds, and sends anyone else away: signed
 * out to /login, the other role to their own home. Logging out here, or in another tab,
 * clears the session and the same rules take the user to /login.
 */
export function SignedInLayout({ role, children }: { role: Role; children: ReactNode }) {
  const stored = useStoredSession();
  const router = useRouter();
  const [check, setCheck] = useState<SessionCheck | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = stored?.token;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    verifySession(token, controller.signal).then(
      (result) => setCheck({ token, result }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        const unexpected = new ApiError(0, "UNEXPECTED_RESPONSE", "Something went wrong while checking your session.");
        setCheck({ token, result: { status: "unreachable", error: unexpected } });
      },
    );
    return () => controller.abort();
  }, [token, attempt]);

  const access = decideAccess(stored, check, role);
  const redirectTo = access.view === "redirect" ? access.to : null;
  const slow = useSlowRequest(access.view === "loading" && Boolean(stored));

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (access.view === "ready") {
    const { token, user } = access.session;
    // A 401 from any page's request: recorded like a rejected /auth/me check, so the
    // same redirect explains on the login page that the session ended.
    const expire = () => {
      if (getSession()?.token !== token) return;
      setCheck({ token, result: { status: "invalid" } });
      clearSession();
    };
    return (
      <AppShell
        nav={<NavLink href={homePath(user.role)}>Dashboard</NavLink>}
        actions={
          <>
            <span className="hidden max-w-48 truncate font-medium sm:inline">{user.name}</span>
            <Badge tone="ink">{user.role}</Badge>
            <Button variant="secondary" onClick={clearSession}>
              Log out
            </Button>
          </>
        }
      >
        <SignedInContext value={{ ...access.session, expire }}>{children}</SignedInContext>
      </AppShell>
    );
  }

  if (access.view === "error") {
    return (
      <AppShell>
        <div className="flex max-w-md flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t check your session</h1>
          <Alert>{access.message}</Alert>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setCheck(null);
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </Button>
            <Button variant="secondary" onClick={clearSession}>
              Log out
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div role="status" className="text-muted">
        <p>{access.view === "redirect" ? "Redirecting…" : "Checking your session…"}</p>
        {slow && <p className="mt-2 text-sm">The server sleeps when idle and can take up to a minute to wake up.</p>}
      </div>
    </AppShell>
  );
}
