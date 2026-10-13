import { useId, type ComponentProps } from "react";

interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Guidance shown above the input, such as a password rule. */
  hint?: string;
  /** Validation message; marks the input invalid and is read out with it. */
  error?: string;
}

/**
 * A labelled input with an optional hint and error. The hint and error are tied to the
 * input through aria-describedby, so screen readers announce them on focus.
 * `className` styles the wrapper, for layout only.
 */
export function TextField({ label, hint, error, className = "", ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {/* text-base (16px) stops iOS Safari zooming into the field on focus. */}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 rounded-xl border bg-white px-4 text-base placeholder:text-muted ${
          error ? "border-danger ring-1 ring-danger" : "border-ink"
        }`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger-ink first-letter:uppercase">
          {error}
        </p>
      )}
    </div>
  );
}
