import Link from "next/link";
import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import { type Campaign, PLATFORM_LABELS, STATUS_LABELS } from "@/lib/campaigns";
import { formatDate } from "@/lib/format";

/**
 * One campaign in a list: everything the list response already contains. The name links
 * to `href`, the campaign's page for the viewer's role.
 */
export function CampaignCard({ campaign, href }: { campaign: Campaign; href: string }) {
  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
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
    </Card>
  );
}
