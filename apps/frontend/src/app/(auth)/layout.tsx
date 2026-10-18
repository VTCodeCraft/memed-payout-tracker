import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { SignedOutOnly } from "@/components/signed-out-only";

/** Login and signup: one centred column on the canvas, shown only to signed-out visitors. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell background="canvas">
      <div className="mx-auto w-full max-w-md md:py-4">
        <SignedOutOnly>{children}</SignedOutOnly>
      </div>
    </AppShell>
  );
}
