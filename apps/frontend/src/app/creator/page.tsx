"use client";

import { CampaignCard, CampaignCardsSkeleton } from "@/components/campaign-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QueryError, QueryLoading } from "@/components/query-status";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import { useApiQuery } from "@/lib/use-api-query";

export default function LiveCampaigns() {
  const session = useSignedInSession();
  // One request: the list already carries each campaign's budget, what is left and its ladder.
  const { state, retry } = useApiQuery<{ campaigns: Campaign[] }>("campaigns/live", session);

  return (
    <>
      <PageHeader
        eyebrow="creator dashboard"
        title="Live campaigns"
        description="Post for a campaign on its platform, then submit the link. A post earns the payout of the highest milestone its views reach, as long as the campaign's budget lasts."
        actions={
          state.status === "success" &&
          state.data.campaigns.length > 0 && (
            <p className="text-sm font-medium text-muted tabular-nums">
              {state.data.campaigns.length} {state.data.campaigns.length === 1 ? "campaign" : "campaigns"} taking posts
            </p>
          )
        }
      />

      <div className="mt-8">
        {state.status === "loading" && (
          <QueryLoading label="Loading live campaigns…">
            <CampaignCardsSkeleton />
          </QueryLoading>
        )}
        {state.status === "error" && (
          <QueryError title="We couldn't load live campaigns" error={state.error} onRetry={retry} />
        )}
        {state.status === "success" && state.data.campaigns.length === 0 && (
          <EmptyState title="No live campaigns right now">
            Campaigns appear here as soon as a brand creates them, and leave once their budget is used up.
          </EmptyState>
        )}
        {state.status === "success" && state.data.campaigns.length > 0 && (
          <ul className="grid gap-6 lg:grid-cols-2">
            {state.data.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <CampaignCard campaign={campaign} href={`/creator/campaigns/${campaign.id}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
