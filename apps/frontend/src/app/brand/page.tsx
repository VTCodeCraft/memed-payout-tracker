"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Notice } from "@/components/alert";
import { Button } from "@/components/button";
import { CampaignCard } from "@/components/campaign-card";
import { Card } from "@/components/card";
import { CreateCampaignForm } from "@/components/create-campaign-form";
import { QueryError, QueryLoading } from "@/components/query-status";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import { useApiQuery } from "@/lib/use-api-query";

export default function BrandDashboard() {
  const session = useSignedInSession();
  // One request: the list already carries each campaign's budget, spend, status and ladder.
  const { state, retry } = useApiQuery<{ campaigns: Campaign[] }>("campaigns/mine", session);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Campaign[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  function openForm() {
    setNotice(null);
    setCreating(true);
  }

  function closeForm() {
    flushSync(() => setCreating(false));
    createButton.current?.focus();
  }

  // The POST response is the campaign exactly as the API stored it, so it joins the list
  // directly: a refetch would return the same data after a round trip and a loading flash.
  function handleCreated(campaign: Campaign) {
    flushSync(() => {
      setCreated((current) => [campaign, ...current]);
      setCreating(false);
      setNotice(`“${campaign.name}” is live. Creators can submit posts to it now.`);
    });
    noticeRef.current?.focus();
  }

  // Newest first, like the API's list; a created campaign also in a reloaded list shows once.
  const campaigns =
    state.status === "success"
      ? [...created, ...state.data.campaigns.filter(({ id }) => !created.some((campaign) => campaign.id === id))]
      : [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium lowercase text-muted">brand dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your campaigns</h1>
        </div>
        {!creating && (
          <Button ref={createButton} onClick={openForm}>
            Create campaign
          </Button>
        )}
      </div>

      {notice && (
        <Notice ref={noticeRef} tabIndex={-1} tone="success" className="mt-6">
          {notice}
        </Notice>
      )}

      {creating && (
        <div className="mt-8 max-w-2xl">
          <CreateCampaignForm onCreated={handleCreated} onCancel={closeForm} />
        </div>
      )}

      <div className="mt-8">
        {state.status === "loading" && <QueryLoading label="Loading your campaigns…" />}
        {state.status === "error" && (
          <QueryError title="We couldn't load your campaigns" error={state.error} onRetry={retry} />
        )}
        {state.status === "success" && campaigns.length === 0 && !creating && (
          <Card className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-tight">No campaigns yet</h2>
            <p className="mt-2 text-muted">
              A campaign has a name, a platform, a budget and a milestone ladder. Creators can submit posts to it as
              soon as it exists.
            </p>
          </Card>
        )}
        {campaigns.length > 0 && (
          <ul className="grid gap-6 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <CampaignCard campaign={campaign} href={`/brand/campaigns/${campaign.id}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
