import type { Milestone } from "@/lib/campaigns";
import { formatRupees, formatViews } from "@/lib/format";

/**
 * A campaign's ladder in order, as pill chips. A post earns the payout of the highest
 * milestone it reaches, so the order is part of the meaning: it is an ordered list.
 */
export function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {milestones.map(({ views, payout }, index) => (
        <li key={views} className="rounded-full border border-ink px-3 py-1 text-sm tabular-nums">
          <span className="sr-only">Milestone {index + 1}: </span>
          {formatViews(views)} views <span aria-hidden="true">→</span>
          <span className="sr-only">pays</span> <span className="font-semibold">{formatRupees(payout)}</span>
        </li>
      ))}
    </ol>
  );
}
