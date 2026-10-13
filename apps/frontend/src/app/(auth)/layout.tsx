import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { SignedOutOnly } from "@/components/signed-out-only";

/** Login and signup: one narrow column, shown only to signed-out visitors. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md">
        <SignedOutOnly>{children}</SignedOutOnly>
      </div>
    </AppShell>
  );
}
