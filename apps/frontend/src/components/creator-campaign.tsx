"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/card";
import { CampaignSummary } from "@/components/campaign-summary";
import { QueryError, QueryLoading } from "@/components/query-status";
import { SubmissionsTable } from "@/components/submissions-table";
import { SubmitPostForm } from "@/components/submit-post-form";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import type { Submission } from "@/lib/submissions";
import { useApiQuery } from "@/lib/use-api-query";

const BACK_LINK = "font-semibold text-brand underline underline-offset-4";

/**
 * A campaign as a creator sees it: its ladder and budget, a form to submit a post, and
 * the creator's own posts in it. Those come from the creator's GET /submissions/mine,
 * never from the brand-only list of every creator's posts.
 */
export function CreatorCampaign({ id }: { id: string }) {
  const session = useSignedInSession();
  const campaign = useApiQuery<{ campaign: Campaign }>(`campaigns/${encodeURIComponent(id)}`, session);
  const mine = useApiQuery<{ submissions: Submission[] }>("submissions/mine", session);
  const [submitted, setSubmitted] = useState<Submission[]>([]);

  const back = (
    <Link href="/creator" className={BACK_LINK}>
      <span aria-hidden="true">← </span>All live campaigns
    </Link>
  );

  if (campaign.state.status === "loading") return <QueryLoading label="Loading campaign…" />;

  if (campaign.state.status === "error") {
    const { error } = campaign.state;
    // 404 for an unknown campaign, 400 for an address that is not a campaign id.
    if (error.status === 404 || error.status === 400) {
      return (
        <div className="flex max-w-xl flex-col items-start gap-4">
          {back}
          <h1 className="text-3xl font-semibold tracking-tight">Campaign not found</h1>
          <p className="text-muted">There is no campaign at this address.</p>
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

  // The POST response is the stored submission, so it joins the list without a refetch.
  const handleSubmitted = (submission: Submission) => setSubmitted((current) => [submission, ...current]);

  const posts =
    mine.state.status === "success"
      ? [
          ...submitted,
          ...mine.state.data.submissions.filter(
            (post) => post.campaignId === details.id && !submitted.some(({ id: newId }) => newId === post.id),
          ),
        ]
      : submitted;

  return (
    <>
      {back}
      <CampaignSummary campaign={details} />

      <div className="mt-10 flex flex-col gap-10">
        <Card className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">Submit a post</h2>
          {details.status === "live" ? (
            <div className="mt-4">
              <SubmitPostForm campaign={details} onSubmitted={handleSubmitted} />
            </div>
          ) : (
            <p className="mt-2 text-muted">This campaign&apos;s budget is used up, so it no longer accepts posts.</p>
          )}
        </Card>

        <section aria-labelledby="your-posts-heading">
          <h2 id="your-posts-heading" className="text-xl font-semibold tracking-tight">
            Your posts in this campaign
          </h2>
          <div className="mt-4">
            {mine.state.status === "loading" && submitted.length === 0 && <QueryLoading label="Loading your posts…" />}
            {mine.state.status === "error" && (
              <QueryError title="We couldn't load your posts" error={mine.state.error} onRetry={mine.retry} />
            )}
            {mine.state.status === "success" && posts.length === 0 && (
              <p className="text-muted">You haven&apos;t submitted a post to this campaign yet.</p>
            )}
            {posts.length > 0 && <SubmissionsTable submissions={posts} campaignOf={() => details} labelledBy="your-posts-heading" />}
          </div>
        </section>
      </div>
    </>
  );
}
