import type { ReactNode } from "react";

type BadgeTone = "outline" | "ink" | "green" | "lime";

// Pill chips as in the Meme'd app screens (outlined "instagram" chips, black step pills).
// Every tone keeps ink text or ink fill, so all pass WCAG AA.
const TONES: Record<BadgeTone, string> = {
  outline: "bg-white text-ink",
  ink: "bg-ink text-white",
  green: "bg-green text-ink",
  lime: "bg-lime text-ink",
};

/** A short status or category label. The text must make sense without the colour. */
export function Badge({ tone = "outline", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-ink px-2.5 py-0.5 text-sm font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
