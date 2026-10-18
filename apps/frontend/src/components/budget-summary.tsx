import { Meter } from "@/components/meter";
import { type Campaign, spentPercent } from "@/lib/campaigns";
import { formatRupees } from "@/lib/format";

/** Budget, spent and remaining, with a bar of the share spent. */
export function BudgetSummary({ campaign }: { campaign: Pick<Campaign, "totalBudget" | "spent" | "remaining"> }) {
  const percent = spentPercent(campaign);
  const figures = [
    { label: "Budget", value: campaign.totalBudget },
    { label: "Spent", value: campaign.spent },
    { label: "Remaining", value: campaign.remaining },
  ];

  return (
    <div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {figures.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatRupees(value)}</dd>
          </div>
        ))}
      </dl>
      <Meter segments={[{ value: percent }]} className="mt-3" />
      <p className="mt-1.5 text-sm text-muted tabular-nums">{percent}% of the budget paid out</p>
    </div>
  );
}
