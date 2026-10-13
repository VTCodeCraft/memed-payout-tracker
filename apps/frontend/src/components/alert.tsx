import type { ReactNode } from "react";

/**
 * An error message that is not tied to one field, such as a failed login or an
 * unreachable server. role="alert" makes screen readers announce it when it appears.
 * The tinted fill keeps it from looking like an invalid input, which is white.
 */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger bg-danger/10 px-4 py-3 text-sm font-medium">
      {children}
    </div>
  );
}
