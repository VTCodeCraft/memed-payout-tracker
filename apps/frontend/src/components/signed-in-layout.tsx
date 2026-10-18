"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Alert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { NavLink } from "@/components/nav-link";
import { QueryLoading } from "@/components/query-status";
import { Skeleton } from "@/components/skeleton";
import { ApiError } from "@/lib/api-client";
import { type SessionCheck, decideAccess } from "@/lib/route-guard";
import { type Role, clearSession, getSession, useStoredSession, verifySession } from "@/lib/session";
import { SignedInContext } from "@/lib/signed-in";

// Each role's main destinations; NavLink marks the current one, including on the
// campaign pages each list opens.
const NAV: Record<Role, { href: string; label: string; activeFor?: string[] }[]> = {
  brand: [{ href: "/brand", label: "Dashboard", activeFor: ["/brand/campaigns/"] }],
  creator: [
    { href: "/creator", label: "Live campaigns", activeFor: ["/creator/campaigns/"] },
    { href: "/creator/earnings", label: "My earnings" },
  ],
};

const ROLE_LABELS: Record<Role, string> = { brand: "Brand", creator: "Creator" };

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
        background="canvas"
        nav={NAV[user.role].map(({ href, label, activeFor }) => (
          <NavLink key={href} href={href} activeFor={activeFor}>
            {label}
          </NavLink>
        ))}
        actions={
          <>
            <UserChip name={user.name} role={user.role} />
            <Button variant="secondary" size="sm" onClick={clearSession}>
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
      <AppShell background="canvas">
        <Card className="flex max-w-md flex-col gap-4">
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
        </Card>
      </AppShell>
    );
  }

  if (access.view === "redirect") {
    return (
      <AppShell background="canvas">
        <p role="status" className="sr-only">
          Redirecting…
        </p>
      </AppShell>
    );
  }

  // Nothing protected is shown until /auth/me answers; the skeleton holds the page's shape.
  return (
    <AppShell background="canvas">
      <QueryLoading label="Checking your session…">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="mt-4 h-48 w-full max-w-3xl rounded-2xl" />
        </div>
      </QueryLoading>
    </AppShell>
  );
}

/** Who is signed in: an initial, then name and role from 1024px up, where they fit beside the nav (screen readers get both below). */
function UserChip({ name, role }: { name: string; role: Role }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint font-semibold text-brand">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <span className="hidden min-w-0 flex-col leading-tight lg:flex">
        <span className="max-w-44 truncate font-medium">{name}</span>
        <span className="text-sm text-muted">{ROLE_LABELS[role]}</span>
      </span>
      <span className="sr-only lg:hidden">
        {name}, {ROLE_LABELS[role]}
      </span>
    </div>
  );
}
