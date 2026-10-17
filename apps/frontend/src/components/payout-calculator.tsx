"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { TextField } from "@/components/text-field";
import { type Milestone, eligiblePayout, highestMilestone } from "@/lib/campaigns";
import { formatRupees, formatViews } from "@/lib/format";

// The hero's worked example, so the calculator opens on the same answer.
const START_VIEWS = 60_000;

/** A view count from what was typed ("1,00,000" is fine), or undefined if it is not one. */
function readViews(raw: string): number | undefined {
  const digits = raw.replace(/[\s,]/g, "");
  if (!/^\d+$/.test(digits)) return undefined;
  const views = Number(digits);
  return Number.isSafeInteger(views) ? views : undefined;
}

function payoutSentence(views: number | undefined, milestones: Milestone[]): string {
  if (views === undefined) return "Enter a whole number of views, such as 60,000.";

  const reached = highestMilestone(views, milestones);
  const next = milestones[reached];
  const count = `${formatViews(views)} views`;
  const nextStep = next ? ` At ${formatViews(next.views)} views the post would earn ${formatRupees(next.payout)}.` : "";

  if (reached === 0) return `${count} haven't reached a milestone yet.${nextStep}`;
  if (!next) {
    return `${count} reach the top milestone and earn ${formatRupees(eligiblePayout(views, milestones))}, the most a post earns here.`;
  }
  return `${count} reach milestone ${reached} of ${milestones.length} and earn ${formatRupees(eligiblePayout(views, milestones))}.${nextStep}`;
}

/**
 * Type a view count, see what one post earns on the ladder. The sentence under the
 * figure is the live region; the large figure and the highlighted row repeat it visually.
 * Every state keeps the same layout, so typing never moves the page.
 */
export function PayoutCalculator({ milestones }: { milestones: Milestone[] }) {
  const [raw, setRaw] = useState(formatViews(START_VIEWS));
  const views = readViews(raw);
  const reached = views === undefined ? 0 : highestMilestone(views, milestones);

  return (
    <Card className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <div>
        <TextField
          label="Views on the post"
          inputMode="numeric"
          autoComplete="off"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          // Regroup the digits once the visitor is done typing, e.g. 100000 becomes 1,00,000.
          onBlur={() => views !== undefined && setRaw(formatViews(views))}
        />
        <p aria-hidden="true" className="mt-6 text-5xl font-semibold tracking-tight tabular-nums">
          {views === undefined ? "–" : formatRupees(eligiblePayout(views, milestones))}
        </p>
        <p aria-live="polite" className="mt-2 min-h-24 text-muted sm:min-h-18 text-pretty tabular-nums">
          {payoutSentence(views, milestones)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Example ladder</p>
        <ol className="flex flex-col gap-2">
          {milestones.map((milestone, index) => {
            const pays = index + 1 === reached;
            return (
              <li
                key={milestone.views}
                aria-current={pays ? "step" : undefined}
                className={`flex min-h-12 items-center justify-between gap-4 rounded-xl border px-4 tabular-nums ${
                  pays ? "border-ink bg-ink text-white" : "border-ink/15"
                }`}
              >
                <span>
                  <span className="sr-only">Milestone {index + 1}: </span>
                  {formatViews(milestone.views)} views
                </span>
                <span className="font-semibold">
                  <span className="sr-only">pays </span>
                  {formatRupees(milestone.payout)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
