import Link from "next/link";
import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { buttonClasses } from "@/components/button";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import { type Campaign, PLATFORM_LABELS, STATUS_LABELS } from "@/lib/campaigns";
import { formatDate } from "@/lib/format";

/**
 * One campaign in a list: everything the list response already contains. The name and an
 * "Open campaign" button both link to `href`, the campaign's page for the viewer's role.
 */
export function CampaignCard({ campaign, href }: { campaign: Campaign; href: string }) {
  const nameId = `campaign-${campaign.id}-name`;

  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={nameId} className="text-xl font-semibold tracking-tight">
            <Link href={href} className="underline-offset-4 hover:underline">
              {campaign.name}
            </Link>
          </h2>
          <p className="text-sm text-muted">Created {formatDate(campaign.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{PLATFORM_LABELS[campaign.platform]}</Badge>
          <Badge tone={campaign.status === "live" ? "green" : "ink"}>{STATUS_LABELS[campaign.status]}</Badge>
        </div>
      </div>
      <BudgetSummary campaign={campaign} />
      <div>
        <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
        <MilestoneList milestones={campaign.milestones} />
      </div>
      {/* A linked name alone did not read as clickable. Every card's button says "Open
          campaign"; the description names the campaign, so screen readers hear which. */}
      <Link href={href} aria-describedby={nameId} className={buttonClasses("secondary", "mt-auto self-start")}>
        Open campaign
      </Link>
    </Card>
  );
}
