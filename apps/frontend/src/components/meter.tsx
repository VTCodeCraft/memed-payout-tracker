type MeterTone = "ink" | "green" | "lime";

const FILLS: Record<MeterTone, string> = { ink: "bg-ink", green: "bg-green", lime: "bg-lime" };

interface MeterProps {
  /** Filled parts, left to right, as percentages of the whole track. */
  segments: { value: number; tone?: MeterTone }[];
  className?: string;
}

/**
 * A horizontal bar of one or more filled parts on a light track. It only repeats figures
 * shown as text beside it, so it is hidden from screen readers.
 */
export function Meter({ segments, className = "" }: MeterProps) {
  return (
    <div aria-hidden="true" className={`flex h-2 overflow-hidden rounded-full bg-ink/10 ${className}`.trim()}>
      {segments.map(({ value, tone = "ink" }, index) => (
        <div key={index} className={`h-full ${FILLS[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      ))}
    </div>
  );
}
