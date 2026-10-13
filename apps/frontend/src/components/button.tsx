import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary";

// Pills as on memed.in: a purple fill for the main action, a 1px ink outline for the rest.
// min-h-11 keeps a 44px touch target.
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-ink",
  secondary: "border border-ink bg-white text-ink hover:bg-ink/5",
};

/** Button classes for elements that act as buttons but are not <button>, such as links. */
export function buttonClasses(variant: ButtonVariant = "primary", className = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

/** Defaults to type="button" so a button inside a form only submits when asked to. */
export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
