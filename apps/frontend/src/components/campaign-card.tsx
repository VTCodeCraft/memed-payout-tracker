import Link from "next/link";
import { CampaignStatusBadge, PlatformBadge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import type { Campaign } from "@/lib/campaigns";
import { formatDate } from "@/lib/format";

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
  return (
    // Hover lifts the card and turns its border brand purple, the colour of links; keyboard
    // focus lifts it too. No movement for people who ask for reduced motion.
    <Card className="group relative flex h-full flex-col gap-5 transition duration-200 ease-out hover:-translate-y-1 hover:border-brand has-[a:focus-visible]:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:has-[a:focus-visible]:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {/* The focus ring is drawn around the whole card, on the stretched ::after. */}
            <Link
              href={href}
              className="underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
            >
              {campaign.name}
            </Link>
          </h2>
          <p className="text-sm text-muted">Created {formatDate(campaign.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PlatformBadge platform={campaign.platform} />
          <CampaignStatusBadge status={campaign.status} />
        </div>
      </div>
      <BudgetSummary campaign={campaign} />
      <div>
        <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
        <MilestoneList milestones={campaign.milestones} />
      </div>
    </Card>
  );
}
