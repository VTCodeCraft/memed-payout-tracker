import { useId } from "react";

interface RadioCardsProps<Value extends string> {
  legend: string;
  name: string;
  options: { value: Value; title: string; description?: string }[];
  value: Value | "";
  onChange: (value: Value) => void;
  error?: string;
}

/**
 * A required single choice shown as bordered cards, with native radio inputs so arrow
 * keys, focus and form submission behave as browsers expect. The chosen card is lime.
 */
export function RadioCards<Value extends string>({ legend, name, options, value, onChange, error }: RadioCardsProps<Value>) {
  const errorId = useId();

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`group flex cursor-pointer gap-3 rounded-2xl border p-4 has-checked:bg-lime ${
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
              className="mt-1 size-4 shrink-0 accent-ink"
            />
            <span>
              <span className="block font-semibold">{option.title}</span>
              {option.description && (
                // Ink on lime: muted grey falls below AA contrast once the card is selected.
                <span className="block text-sm text-muted group-has-checked:text-ink">{option.description}</span>
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
