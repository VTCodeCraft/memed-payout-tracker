import { Badge } from "@/components/badge";
import { type Campaign, highestMilestone } from "@/lib/campaigns";
import { formatRupees, formatViews } from "@/lib/format";
import type { Submission } from "@/lib/submissions";

interface SubmissionsTableProps {
  submissions: Submission[];
  /** The campaign the posts belong to, for its ladder. */
  campaign: Campaign;
  /** Id of the heading that names the table, for the scrollable region. */
  labelledBy: string;
}

/**
 * Posts with their views, the highest milestone reached, what they earned and what the
 * budget actually paid. Earned and paid differ only when a campaign's budget ran out.
 */
export function SubmissionsTable({ submissions, campaign, labelledBy }: SubmissionsTableProps) {
  return (
    // Focusable so keyboard users can scroll the table sideways on narrow screens.
    <div tabIndex={0} role="region" aria-labelledby={labelledBy} className="overflow-x-auto">
      <table className="w-full min-w-xl text-left tabular-nums">
        <thead className="text-sm text-muted">
          <tr>
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
            const reached = highestMilestone(submission.views, campaign.milestones);
            const short = submission.eligiblePayout - submission.paidPayout;
            return (
              <tr key={submission.id} className="border-t border-ink/10">
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
                <td className="py-3 pr-4">{reached === 0 ? "None yet" : `${reached} of ${campaign.milestones.length}`}</td>
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
