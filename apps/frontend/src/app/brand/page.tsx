"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Notice } from "@/components/alert";
import { Button } from "@/components/button";
import { CampaignCard, CampaignCardsSkeleton } from "@/components/campaign-card";
import { CreateCampaignForm } from "@/components/create-campaign-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QueryError, QueryLoading } from "@/components/query-status";
import type { Campaign } from "@/lib/campaigns";
import { formatRupees } from "@/lib/format";
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
      <PageHeader
        eyebrow="brand dashboard"
        title="Your campaigns"
        actions={
          !creating && (
            <Button ref={createButton} onClick={openForm}>
              Create campaign
            </Button>
          )
        }
      />

      {notice && (
        <Notice ref={noticeRef} tabIndex={-1} tone="success" className="mt-6">
          {notice}
        </Notice>
      )}

      {campaigns.length > 0 && <Totals campaigns={campaigns} />}

      {creating && (
        <div className="mt-8 max-w-2xl">
          <CreateCampaignForm onCreated={handleCreated} onCancel={closeForm} />
        </div>
      )}

      <div className="mt-8">
        {state.status === "loading" && (
          <QueryLoading label="Loading your campaigns…">
            <CampaignCardsSkeleton />
          </QueryLoading>
        )}
        {state.status === "error" && (
          <QueryError title="We couldn't load your campaigns" error={state.error} onRetry={retry} />
        )}
        {state.status === "success" && campaigns.length === 0 && !creating && (
          <EmptyState title="No campaigns yet">
            A campaign has a name, a platform, a budget and a milestone ladder. Creators can submit posts to it as soon
            as it exists. Use Create campaign to set up your first one.
          </EmptyState>
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

/** Sums across the brand's campaigns, all from the list the page already has. */
function Totals({ campaigns }: { campaigns: Campaign[] }) {
  const live = campaigns.filter((campaign) => campaign.status === "live").length;
  const sum = (key: "totalBudget" | "spent" | "remaining") => campaigns.reduce((total, campaign) => total + campaign[key], 0);
  const figures = [
    { label: "Live campaigns", value: `${live} of ${campaigns.length}` },
    { label: "Total budget", value: formatRupees(sum("totalBudget")) },
    { label: "Paid out", value: formatRupees(sum("spent")) },
    { label: "Left to pay out", value: formatRupees(sum("remaining")) },
  ];

  return (
    <section aria-label="Totals across your campaigns" className="mt-8">
      {/* 1px gaps over an ink/10 fill draw the dividers between the figures. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink bg-ink/10 lg:grid-cols-4">
        {figures.map(({ label, value }) => (
          <div key={label} className="bg-white p-4 md:p-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums md:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
