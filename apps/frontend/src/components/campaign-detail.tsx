"use client";

import Link from "next/link";
import { CampaignSummary } from "@/components/campaign-summary";
import { QueryError, QueryLoading } from "@/components/query-status";
import { SubmissionsTable } from "@/components/submissions-table";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import type { Submission } from "@/lib/submissions";
import { useApiQuery } from "@/lib/use-api-query";

const BACK_LINK = "font-semibold text-brand underline underline-offset-4";

/**
 * One of the brand's campaigns with its submissions, which the dashboard list does not
 * include. The API answers 404 for another brand's campaign (and 400 for an id that is
 * not one), and both read here as "not found", without saying whether it exists.
 */
export function CampaignDetail({ id }: { id: string }) {
  const session = useSignedInSession();
  const path = `campaigns/${encodeURIComponent(id)}`;
  const campaign = useApiQuery<{ campaign: Campaign }>(path, session);
  const submissions = useApiQuery<{ submissions: Submission[] }>(`${path}/submissions`, session);

  const back = (
    <Link href="/brand" className={BACK_LINK}>
      <span aria-hidden="true">← </span>All campaigns
    </Link>
  );

  if (campaign.state.status === "loading") return <QueryLoading label="Loading campaign…" />;

  if (campaign.state.status === "error") {
    const { error } = campaign.state;
    if (error.status === 404 || error.status === 400) {
      return (
        <div className="flex max-w-xl flex-col items-start gap-4">
          {back}
          <h1 className="text-3xl font-semibold tracking-tight">Campaign not found</h1>
          <p className="text-muted">There is no campaign at this address in your account.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start gap-6">
        {back}
        <QueryError title="We couldn't load this campaign" error={error} onRetry={campaign.retry} />
      </div>
    );
  }

  const { campaign: details } = campaign.state.data;

  return (
    <>
      {back}
      <CampaignSummary campaign={details} />

      <section aria-labelledby="submissions-heading" className="mt-10">
        <h2 id="submissions-heading" className="text-2xl font-semibold tracking-tight">
          Submissions
        </h2>
        <div className="mt-4">
          {submissions.state.status === "loading" && <QueryLoading label="Loading submissions…" />}
          {submissions.state.status === "error" && (
            <QueryError
              title="We couldn't load the submissions"
              error={submissions.state.error}
              onRetry={submissions.retry}
            />
          )}
          {submissions.state.status === "success" &&
            (submissions.state.data.submissions.length === 0 ? (
              <p className="text-muted">
                {details.status === "live"
                  ? "No posts yet. Creators can submit posts while the campaign is live."
                  : "No posts were submitted before the budget ran out."}
              </p>
            ) : (
              <SubmissionsTable
                submissions={submissions.state.data.submissions}
                campaignOf={() => details}
                labelledBy="submissions-heading"
              />
            ))}
        </div>
      </section>
    </>
  );
}
