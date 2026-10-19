import type { ComponentProps, ReactNode } from "react";

type NoticeTone = "error" | "success" | "info";

// Error keeps a tinted fill so it never looks like an invalid input, which is white.
// Success is lime and information the brand tint; both carry ink text only.
const TONES: Record<NoticeTone, string> = {
  error: "border-danger bg-danger/10",
  success: "border-ink bg-lime",
  info: "border-ink bg-brand-tint",
};

interface NoticeProps extends ComponentProps<"div"> {
  tone?: NoticeTone;
}

/**
 * A message about the page rather than one field: a failed request, a saved campaign, an
 * ended session. Errors are role="alert" so screen readers announce them at once; success
 * and information are role="status". Pass ref and tabIndex={-1} to move focus to it.
 */
export function Notice({ tone = "info", className = "", children, ...props }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${TONES[tone]} ${className}`.trim()}
      {...props}
    >
      <NoticeIcon tone={tone} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** An error message that is not tied to one field, such as a failed login or an unreachable server. */
export function Alert({ children }: { children: ReactNode }) {
  return <Notice tone="error">{children}</Notice>;
}

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`mt-px size-4.5 shrink-0 ${tone === "error" ? "text-danger-ink" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      {tone === "success" && <path d="m8.5 12.5 2.5 2.5 4.5-5" />}
      {tone === "error" && <path d="M12 7.5v5.5M12 16.5h.01" />}
      {tone === "info" && <path d="M12 11v5.5M12 7.5h.01" />}
    </svg>
  );
}
