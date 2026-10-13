import type { ComponentProps } from "react";

/**
 * The bordered surface for campaigns, totals and forms: 16px radius as on WLDD's
 * careers cards, 1px ink border and no shadow as on memed.in.
 * `className` is for layout (margins, grid placement), not for restyling the card.
 */
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-ink bg-white p-5 md:p-6 ${className}`.trim()} {...props} />;
}
