import { type ReactNode, useId } from "react";

interface RadioCardsProps<Value extends string> {
  legend: string;
  name: string;
  options: { value: Value; title: string; description?: string; icon?: ReactNode }[];
  value: Value | "";
  onChange: (value: Value) => void;
  error?: string;
  /** Two cards side by side from 640px (short options), or one per row (options with descriptions). */
  columns?: 1 | 2;
}

/**
 * A required single choice shown as bordered cards, with native radio inputs so arrow
 * keys, focus and form submission behave as browsers expect. The chosen card is lime with
 * a filled dot; keyboard focus rings the whole card.
 */
export function RadioCards<Value extends string>({ legend, name, options, value, onChange, error, columns = 2 }: RadioCardsProps<Value>) {
  const errorId = useId();

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className={`mt-1.5 grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`group flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 transition-colors duration-150 has-checked:bg-lime [&:not(:has(:checked)):hover]:bg-ink/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand motion-reduce:transition-none ${
              error ? "border-danger ring-1 ring-danger" : "border-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-describedby={error ? errorId : undefined}
              // A drawn dot: an ink ring that fills to a thick border when chosen. The card shows focus instead.
              className="mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-ink bg-white checked:border-[6px] focus-visible:outline-none"
            />
            {option.icon && (
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas group-has-checked:bg-white">
                {option.icon}
              </span>
            )}
            <span className="min-w-0">
              <span className="block font-semibold">{option.title}</span>
              {option.description && (
                // Ink on lime: muted grey falls below AA contrast once the card is selected.
                <span className="block text-sm text-muted text-pretty group-has-checked:text-ink">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger-ink first-letter:uppercase">
          {error}
        </p>
      )}
    </fieldset>
  );
}
