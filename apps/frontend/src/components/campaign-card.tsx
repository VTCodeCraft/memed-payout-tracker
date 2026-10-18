import Link from "next/link";
import { CampaignStatusBadge, PlatformBadge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import { Skeleton } from "@/components/skeleton";
import type { Campaign } from "@/lib/campaigns";
import { formatDate, formatRupees } from "@/lib/format";

/**
 * One campaign in a list: everything the list response already contains. The whole card
 * opens `href`, the campaign's page for the viewer's role.
 *
 * The name is the card's only link, and its ::after is stretched over the card, so a click
 * anywhere opens it (with the pointer cursor) while screen readers and the keyboard still
 * meet one link named after the campaign. A link wrapping the whole card would instead read
 * every figure in it as the link's name.
 */
export function CampaignCard({ campaign, href }: { campaign: Campaign; href: string }) {
  const topPayout = campaign.milestones.at(-1)?.payout ?? 0;

  return (
    // Hover lifts the card, turns its border brand purple (the colour of links) and nudges
    // the arrow; keyboard focus lifts it too. No movement for people who ask for reduced motion.
    <Card className="group relative flex h-full flex-col gap-5 transition duration-200 ease-out hover:-translate-y-1 hover:border-brand has-[a:focus-visible]:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:has-[a:focus-visible]:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <PlatformBadge platform={campaign.platform} />
          <CampaignStatusBadge status={campaign.status} />
        </div>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/15 transition duration-200 group-hover:translate-x-0.5 group-hover:border-brand group-hover:text-brand motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {/* The focus ring is drawn around the whole card, on the stretched ::after. */}
          <Link
            href={href}
            className="underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
          >
            {campaign.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Created {formatDate(campaign.createdAt)} · pays up to{" "}
          <span className="font-semibold text-ink tabular-nums">{formatRupees(topPayout)}</span> a post
        </p>
      </div>
      <BudgetSummary campaign={campaign} />
      <div className="mt-auto border-t border-ink/10 pt-4">
        <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
        <MilestoneList milestones={campaign.milestones} />
      </div>
    </Card>
  );
}

/** Two card-shaped placeholders while a campaign list loads. */
export function CampaignCardsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[0, 1].map((card) => (
        <div key={card} className="flex flex-col gap-5 rounded-2xl border border-ink/15 bg-white p-5 md:p-6">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="h-7 w-2/3" />
          <div className="flex gap-8">
            <Skeleton className="h-11 w-20" />
            <Skeleton className="h-11 w-20" />
            <Skeleton className="h-11 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-8 w-3/4 rounded-full" />
        </div>
      ))}
    </div>
  );
}
