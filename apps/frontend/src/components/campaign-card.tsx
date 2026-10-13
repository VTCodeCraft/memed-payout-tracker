import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import { type Campaign, PLATFORM_LABELS, STATUS_LABELS } from "@/lib/campaigns";
import { formatDate } from "@/lib/format";

/** One campaign on the brand dashboard: everything the list response already contains. */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{campaign.name}</h2>
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
