import Link from "next/link";
import { Badge } from "@/components/badge";
import { Meter } from "@/components/meter";
import { Skeleton } from "@/components/skeleton";
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
  /** Marks posts whose views grew unusually fast, for the brand to review. */
  showSpikeFlags?: boolean;
}

// One table on every screen. From 1024px it is a table; below, each row becomes a card with
// its cells in a two-column grid (two cards side by side from 768px), each labelled by a CSS caption from data-label. The
// caption's empty alt text ("/ ''") keeps screen readers from reading it on top of the
// column header, and the explicit ARIA roles keep table semantics, which some browsers
// drop when table elements are restyled.
const CELL =
  "lg:py-3 lg:pr-4 max-lg:before:mb-0.5 max-lg:before:block max-lg:before:text-xs max-lg:before:font-medium max-lg:before:text-muted max-lg:before:content-[attr(data-label)_/_'']";
const NUMBER = "lg:text-right";

/**
 * Posts with their views, the highest milestone reached, what they earned and what the
 * budget actually paid. Earned and paid differ only when a campaign's budget ran out.
 */
export function SubmissionsTable({ submissions, campaignOf, campaignHref, labelledBy, showSpikeFlags = false }: SubmissionsTableProps) {
  return (
    // Focusable so keyboard users can scroll the table sideways if it is ever wider than its box. `relative`
    // makes this box the containing block of the absolutely positioned sr-only text, so it
    // scrolls with the table instead of escaping it and widening the page.
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={labelledBy}
      className="relative lg:overflow-x-auto lg:rounded-2xl lg:border lg:border-ink lg:bg-white lg:px-5 lg:pt-4 lg:pb-2"
    >
      <table role="table" className="w-full text-left tabular-nums lg:min-w-2xl">
        <thead role="rowgroup" className="text-sm text-muted max-lg:sr-only">
          <tr role="row" className="lg:border-b lg:border-ink/15">
            {campaignHref && (
              <th role="columnheader" scope="col" className="pb-2 pr-4 font-medium">Campaign</th>
            )}
            <th role="columnheader" scope="col" className="pb-2 pr-4 font-medium">Post</th>
            <th role="columnheader" scope="col" className={`pb-2 pr-4 font-medium ${NUMBER}`}>Views</th>
            <th role="columnheader" scope="col" className="pb-2 pr-4 font-medium">Milestone reached</th>
            <th role="columnheader" scope="col" className={`pb-2 pr-4 font-medium ${NUMBER}`}>Earned</th>
            <th role="columnheader" scope="col" className={`pb-2 pr-4 font-medium ${NUMBER}`}>Paid</th>
            <th role="columnheader" scope="col" className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-lg:grid max-lg:gap-3 md:max-lg:grid-cols-2">
          {submissions.map((submission) => {
            const campaign = campaignOf(submission);
            const short = submission.eligiblePayout - submission.paidPayout;
            return (
              <tr
                key={submission.id}
                role="row"
                className="align-middle max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-3 max-lg:rounded-2xl max-lg:border max-lg:border-ink max-lg:bg-white max-lg:p-4 lg:border-b lg:border-ink/10 lg:last:border-b-0"
              >
                {campaignHref && (
                  <td role="cell" data-label="Campaign" className={`${CELL} max-lg:col-span-2`}>
                    <Link
                      href={campaignHref(submission.campaignId)}
                      className="font-semibold underline-offset-4 hover:text-brand hover:underline"
                    >
                      {campaign?.name ?? "View campaign"}
                    </Link>
                  </td>
                )}
                <td role="cell" data-label="Post" className={`${CELL} max-lg:col-span-2`}>
                  <a
                    href={submission.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline underline-offset-4 max-lg:break-all"
                  >
                    {submission.normalizedUrl.replace(/^https:\/\/(www\.)?/, "")}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </td>
                <td role="cell" data-label="Views" className={`${CELL} ${NUMBER}`}>
                  {formatViews(submission.views)}
                </td>
                <td role="cell" data-label="Milestone reached" className={CELL}>
                  {campaign ? <MilestoneProgress views={submission.views} campaign={campaign} /> : "—"}
                </td>
                <td role="cell" data-label="Earned" className={`${CELL} ${NUMBER}`}>
                  {formatRupees(submission.eligiblePayout)}
                </td>
                <td role="cell" data-label="Paid" className={`${CELL} ${NUMBER} font-semibold`}>
                  {formatRupees(submission.paidPayout)}
                </td>
                <td role="cell" data-label="Status" className={`${CELL} max-lg:col-span-2 lg:py-3`}>
                  <span className="flex flex-wrap gap-1.5">
                    {submission.eligiblePayout === 0 ? (
                      <Badge>Not yet eligible</Badge>
                    ) : short > 0 ? (
                      <Badge tone="lime">{formatRupees(short)} unfunded</Badge>
                    ) : (
                      <Badge tone="green">Paid in full</Badge>
                    )}
                    {showSpikeFlags && submission.viewSpike && (
                      <>
                        {" "}
                        <Badge tone="tint">Fast growth</Badge>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showSpikeFlags && submissions.some((submission) => submission.viewSpike) && (
        <p className="mt-3 text-sm text-muted lg:mb-2 lg:border-t lg:border-ink/10 lg:pt-3">
          <span className="font-semibold text-ink">Fast growth</span> marks a post whose views rose by 10,000 or more
          in an hour at least once. It is a prompt to review the post; it never changes a payout.
        </p>
      )}
    </div>
  );
}

/**
 * "2 of 3", with a bar for the way from the milestone reached to the next one (full at the
 * top milestone). The bar repeats the text visually, so the cell's text is just the count.
 */
function MilestoneProgress({ views, campaign }: { views: number; campaign: Campaign }) {
  const { milestones } = campaign;
  const reached = highestMilestone(views, milestones);
  const from = milestones[reached - 1]?.views ?? 0;
  const next = milestones[reached];
  const progress = next ? ((views - from) / (next.views - from)) * 100 : 100;

  return (
    <div className="flex flex-col gap-1.5">
      {reached === 0 ? "None yet" : `${reached} of ${milestones.length}`}
      <Meter segments={[{ value: progress, tone: next ? "ink" : "green" }]} className="w-full max-w-28" />
    </div>
  );
}

/** Rows of placeholders in the table's shape, while posts load. */
export function SubmissionsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-14 w-full rounded-2xl lg:h-10 lg:rounded-lg" />
      ))}
    </div>
  );
}

/** How many posts, and what they earned and were paid in total; unfunded only when some is. */
export function SubmissionTotals({ posts }: { posts: Submission[] }) {
  const earned = posts.reduce((total, post) => total + post.eligiblePayout, 0);
  const paid = posts.reduce((total, post) => total + post.paidPayout, 0);

  return (
    <p className="text-sm text-muted tabular-nums">
      {posts.length} {posts.length === 1 ? "post" : "posts"} · earned {formatRupees(earned)} · paid{" "}
      <span className="font-semibold text-ink">{formatRupees(paid)}</span>
      {earned > paid && <> · {formatRupees(earned - paid)} unfunded</>}
    </p>
  );
}
