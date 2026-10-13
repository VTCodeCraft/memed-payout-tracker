import Link from "next/link";
import { Badge } from "@/components/badge";
import { type Campaign, highestMilestone } from "@/lib/campaigns";
import { formatRupees, formatViews } from "@/lib/format";
import type { Submission } from "@/lib/submissions";

interface SubmissionsTableProps {
  submissions: Submission[];
  /** The campaign a post belongs to, for its ladder (and its name in the Campaign column). */
  campaignOf: (submission: Submission) => Campaign | undefined;
  /** Adds a Campaign column whose names link to this address. */
  campaignHref?: (campaignId: string) => string;
  /** Id of the heading that names the table, for the scrollable region. */
  labelledBy: string;
}

/**
 * Posts with their views, the highest milestone reached, what they earned and what the
 * budget actually paid. Earned and paid differ only when a campaign's budget ran out.
 */
export function SubmissionsTable({ submissions, campaignOf, campaignHref, labelledBy }: SubmissionsTableProps) {
  return (
    // Focusable so keyboard users can scroll the table sideways on narrow screens. `relative`
    // makes this box the containing block of the absolutely positioned sr-only labels, so they
    // scroll with the table instead of escaping it and widening the page on a phone.
    <div tabIndex={0} role="region" aria-labelledby={labelledBy} className="relative overflow-x-auto">
      <table className="w-full min-w-xl text-left tabular-nums">
        <thead className="text-sm text-muted">
          <tr>
            {campaignHref && (
              <th scope="col" className="pb-2 pr-4 font-medium">Campaign</th>
            )}
            <th scope="col" className="pb-2 pr-4 font-medium">Post</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Views</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Milestone reached</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Earned</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Paid</th>
            <th scope="col" className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => {
            const campaign = campaignOf(submission);
            const short = submission.eligiblePayout - submission.paidPayout;
            return (
              <tr key={submission.id} className="border-t border-ink/10">
                {campaignHref && (
                  <td className="py-3 pr-4">
                    <Link href={campaignHref(submission.campaignId)} className="font-medium underline underline-offset-4">
                      {campaign?.name ?? "View campaign"}
                    </Link>
                  </td>
                )}
                <td className="py-3 pr-4">
                  <a
                    href={submission.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    {submission.normalizedUrl.replace(/^https:\/\/(www\.)?/, "")}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </td>
                <td className="py-3 pr-4">{formatViews(submission.views)}</td>
                <td className="py-3 pr-4">{campaign ? milestoneReached(submission.views, campaign) : "—"}</td>
                <td className="py-3 pr-4">{formatRupees(submission.eligiblePayout)}</td>
                <td className="py-3 pr-4 font-semibold">{formatRupees(submission.paidPayout)}</td>
                <td className="py-3">
                  {submission.eligiblePayout === 0 ? (
                    <Badge>Not yet eligible</Badge>
                  ) : short > 0 ? (
                    <Badge tone="lime">{formatRupees(short)} unfunded</Badge>
                  ) : (
                    <Badge tone="green">Paid in full</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function milestoneReached(views: number, campaign: Campaign): string {
  const reached = highestMilestone(views, campaign.milestones);
  return reached === 0 ? "None yet" : `${reached} of ${campaign.milestones.length}`;
}
