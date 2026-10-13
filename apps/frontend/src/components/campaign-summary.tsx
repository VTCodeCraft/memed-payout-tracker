import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { type Campaign, PLATFORM_LABELS, STATUS_LABELS } from "@/lib/campaigns";
import { formatDate, formatRupees, formatViews } from "@/lib/format";

/** A campaign page's heading, status, budget and ladder, as brands and creators both see it. */
export function CampaignSummary({ campaign }: { campaign: Campaign }) {
  return (
    <>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{campaign.name}</h1>
          <p className="mt-1 text-muted">Created {formatDate(campaign.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{PLATFORM_LABELS[campaign.platform]}</Badge>
          <Badge tone={campaign.status === "live" ? "green" : "ink"}>{STATUS_LABELS[campaign.status]}</Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Budget</h2>
          <BudgetSummary campaign={campaign} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Milestone ladder</h2>
          <table className="w-full text-left tabular-nums">
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="pb-2 font-medium">Milestone</th>
                <th scope="col" className="pb-2 font-medium">Views</th>
                <th scope="col" className="pb-2 font-medium">Pays</th>
              </tr>
            </thead>
            <tbody>
              {campaign.milestones.map(({ views, payout }, index) => (
                <tr key={views} className="border-t border-ink/10">
                  <th scope="row" className="py-2 font-medium">{index + 1}</th>
                  <td className="py-2">{formatViews(views)}</td>
                  <td className="py-2 font-semibold">{formatRupees(payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
