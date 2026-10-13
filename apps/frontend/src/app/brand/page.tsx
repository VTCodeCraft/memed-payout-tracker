"use client";

import { CampaignCard } from "@/components/campaign-card";
import { Card } from "@/components/card";
import { QueryError, QueryLoading } from "@/components/query-status";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import { useApiQuery } from "@/lib/use-api-query";

export default function BrandDashboard() {
  const session = useSignedInSession();
  // One request: the list already carries each campaign's budget, spend, status and ladder.
  const { state, retry } = useApiQuery<{ campaigns: Campaign[] }>("campaigns/mine", session);

  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">brand dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your campaigns</h1>

      <div className="mt-8">
        {state.status === "loading" && <QueryLoading label="Loading your campaigns…" />}
        {state.status === "error" && (
          <QueryError title="We couldn't load your campaigns" error={state.error} onRetry={retry} />
        )}
        {state.status === "success" && state.data.campaigns.length === 0 && (
          <Card className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-tight">No campaigns yet</h2>
            <p className="mt-2 text-muted">
              A campaign has a name, a platform, a budget and a milestone ladder. Creators can submit posts to it as
              soon as it exists.
            </p>
          </Card>
        )}
        {state.status === "success" && state.data.campaigns.length > 0 && (
          <ul className="grid gap-6 lg:grid-cols-2">
            {state.data.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <CampaignCard campaign={campaign} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
