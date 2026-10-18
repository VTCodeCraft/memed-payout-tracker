import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

// Pills as on memed.in: a purple fill for the main action, a 1px ink outline for the rest,
// and a borderless ghost for low-emphasis actions inside forms and lists. Every size keeps
// min-h-11, a 44px touch target. Pressing nudges the button down a pixel.
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 motion-reduce:transition-none motion-reduce:active:translate-y-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-ink",
  secondary: "border border-ink bg-white text-ink hover:bg-ink/5",
  ghost: "text-ink hover:bg-ink/5",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5 text-base",
  sm: "px-4 text-sm",
};

/** Button classes for elements that act as buttons but are not <button>, such as links. */
export function buttonClasses(variant: ButtonVariant = "primary", className = "", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button while its action runs; the label should say so too. */
  loading?: boolean;
}

/** Defaults to type="button" so a button inside a form only submits when asked to. */
export function Button({ variant = "primary", size = "md", loading = false, type = "button", className, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, className, size)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** A quarter-arc that turns while an action runs; it holds still for reduced motion. */
function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 motion-safe:animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
