"use client";

import { CampaignCard } from "@/components/campaign-card";
import { Card } from "@/components/card";
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
      <p className="text-sm font-medium lowercase text-muted">creator dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Live campaigns</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Post for a campaign on its platform, then submit the link. A post earns the payout of the highest milestone its
        views reach, as long as the campaign&apos;s budget lasts.
      </p>

      <div className="mt-8">
        {state.status === "loading" && <QueryLoading label="Loading live campaigns…" />}
        {state.status === "error" && (
          <QueryError title="We couldn't load live campaigns" error={state.error} onRetry={retry} />
        )}
        {state.status === "success" && state.data.campaigns.length === 0 && (
          <Card className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-tight">No live campaigns right now</h2>
            <p className="mt-2 text-muted">
              Campaigns appear here as soon as a brand creates them, and leave once their budget is used up.
            </p>
          </Card>
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
