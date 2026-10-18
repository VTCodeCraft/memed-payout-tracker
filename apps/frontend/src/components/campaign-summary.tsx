import { CampaignStatusBadge, PlatformBadge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";
import { type Campaign, type Milestone, highestMilestone } from "@/lib/campaigns";
import { formatDate, formatRupees, formatViews } from "@/lib/format";

/** A campaign page's title with its platform, status and creation date, under a link back to its list. */
export function CampaignHeader({ campaign, back }: { campaign: Campaign; back: { href: string; label: string } }) {
  return (
    <PageHeader
      back={back}
      title={campaign.name}
      meta={
        <>
          <PlatformBadge platform={campaign.platform} />
          <CampaignStatusBadge status={campaign.status} />
          <span className="text-sm text-muted">Created {formatDate(campaign.createdAt)}</span>
        </>
      }
    />
  );
}

interface CampaignOverviewProps {
  campaign: Campaign;
  /** Views of the posts to count against the ladder, such as a campaign's submissions. */
  postViews?: number[];
  /** What the counts are, shown under the ladder, e.g. "Posts that have reached each milestone". */
  postsCaption?: string;
}

/** The budget and the milestone ladder, as brands and creators both see them. */
export function CampaignOverview({ campaign, postViews, postsCaption }: CampaignOverviewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Budget</h2>
        <BudgetSummary campaign={campaign} />
        <p className="mt-5 border-t border-ink/10 pt-4 text-sm text-pretty">
          <BudgetOutlook campaign={campaign} />
        </p>
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Milestone ladder</h2>
        <MilestoneLadder milestones={campaign.milestones} postViews={postViews} />
        {postViews && postsCaption && <p className="mt-4 text-sm text-muted">{postsCaption}</p>}
      </Card>
    </div>
  );
}

/** What the remaining budget can still pay, in terms of the ladder's top payout. */
function BudgetOutlook({ campaign }: { campaign: Campaign }) {
  const topPayout = campaign.milestones.at(-1)?.payout ?? 0;
  if (campaign.remaining <= 0 || topPayout <= 0) {
    return <>The budget is used up. Milestones that posts reach from now on are recorded as unfunded, not paid.</>;
  }
  const posts = Math.floor(campaign.remaining / topPayout);
  return posts >= 1 ? (
    <>
      What&apos;s left covers at least{" "}
      <span className="font-semibold tabular-nums">
        {posts} {posts === 1 ? "post" : "posts"}
      </span>{" "}
      at the top milestone ({formatRupees(topPayout)} each).
    </>
  ) : (
    <>
      What&apos;s left is less than the top payout of {formatRupees(topPayout)}, so a post reaching it may be paid only in part.
    </>
  );
}

/**
 * The ladder as numbered steps, each with how many of the given posts have it as their
 * highest milestone so far. A post earns the payout of the highest step it reaches.
 */
function MilestoneLadder({ milestones, postViews }: { milestones: Milestone[]; postViews?: number[] }) {
  const counts = milestones.map(
    (_, index) => postViews?.filter((views) => highestMilestone(views, milestones) === index + 1).length ?? 0,
  );

  return (
    <ol className="flex flex-col divide-y divide-ink/10">
      {milestones.map(({ views, payout }, index) => (
        <li key={views} className="flex items-center gap-4 py-3 tabular-nums first:pt-0 last:pb-0">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-ink text-sm font-semibold">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="sr-only">Milestone {index + 1}: </span>
            {formatViews(views)} views
            {postViews && (
              <span className="block text-sm text-muted">
                {counts[index]} {counts[index] === 1 ? "post" : "posts"}
              </span>
            )}
          </span>
          <span className="font-semibold">
            <span className="sr-only">pays </span>
            {formatRupees(payout)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Placeholders in the shape of a campaign page's header and overview, while it loads. */
export function CampaignSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-6 w-56 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  );
}
