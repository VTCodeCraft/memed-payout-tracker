"use client";

import { useState } from "react";
import { Notice } from "@/components/alert";
import { Card } from "@/components/card";
import { CampaignHeader, CampaignOverview, CampaignSkeleton } from "@/components/campaign-summary";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QueryError, QueryLoading } from "@/components/query-status";
import { SubmissionTotals, SubmissionsSkeleton, SubmissionsTable } from "@/components/submissions-table";
import { SubmitPostForm } from "@/components/submit-post-form";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import type { Submission } from "@/lib/submissions";
import { useApiQuery } from "@/lib/use-api-query";

const BACK = { href: "/creator", label: "All live campaigns" };

const WHAT_TO_POST: Record<Campaign["platform"], string> = {
  instagram: "Post a photo or reel on Instagram for this campaign.",
  youtube: "Post a video or Short on YouTube for this campaign.",
};

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

  if (campaign.state.status === "loading") {
    return (
      <QueryLoading label="Loading campaign…">
        <CampaignSkeleton />
      </QueryLoading>
    );
  }

  if (campaign.state.status === "error") {
    const { error } = campaign.state;
    // 404 for an unknown campaign, 400 for an address that is not a campaign id.
    if (error.status === 404 || error.status === 400) {
      return <PageHeader back={BACK} title="Campaign not found" description="There is no campaign at this address." />;
    }
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={BACK} title="Campaign" />
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
      <CampaignHeader campaign={details} back={BACK} />

      {/* From 1280px: overview and posts on the left, the submit panel pinned on the right
          (narrower, the posts table would not fit beside it). Below: overview, then submit,
          then posts, so the main action is not at the bottom. */}
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="xl:col-start-1">
          <CampaignOverview
            campaign={details}
            postViews={mine.state.status === "success" ? posts.map((post) => post.views) : undefined}
            postsCaption="Your posts counted under the highest milestone each has reached so far."
          />
        </div>

        <Card className="xl:sticky xl:top-8 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <h2 className="text-xl font-semibold tracking-tight">Submit a post</h2>
          {details.status === "live" ? (
            <>
              <ol className="mt-3 flex flex-col gap-2 text-sm text-muted">
                {[
                  WHAT_TO_POST[details.platform],
                  "Paste its link below and submit it.",
                  "As its views are recorded, it earns the highest milestone it reaches, while the budget lasts.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-pretty">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 border-t border-ink/10 pt-5">
                <SubmitPostForm campaign={details} onSubmitted={handleSubmitted} />
              </div>
            </>
          ) : (
            <Notice tone="info" className="mt-3">
              This campaign&apos;s budget is used up, so it no longer accepts posts.
            </Notice>
          )}
        </Card>

        <section aria-labelledby="your-posts-heading" className="min-w-0 xl:col-start-1">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id="your-posts-heading" className="text-xl font-semibold tracking-tight">
              Your posts in this campaign
            </h2>
            {posts.length > 0 && <SubmissionTotals posts={posts} />}
          </div>
          <div className="mt-4">
            {mine.state.status === "loading" && submitted.length === 0 && (
              <QueryLoading label="Loading your posts…">
                <SubmissionsSkeleton />
              </QueryLoading>
            )}
            {mine.state.status === "error" && (
              <QueryError title="We couldn't load your posts" error={mine.state.error} onRetry={mine.retry} />
            )}
            {mine.state.status === "success" && posts.length === 0 && (
              <EmptyState title="No posts yet" headingLevel={3}>
                You haven&apos;t submitted a post to this campaign yet.
              </EmptyState>
            )}
            {posts.length > 0 && <SubmissionsTable submissions={posts} campaignOf={() => details} labelledBy="your-posts-heading" />}
          </div>
        </section>
      </div>
    </>
  );
}
