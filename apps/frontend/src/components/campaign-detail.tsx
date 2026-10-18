"use client";

import { CampaignHeader, CampaignOverview, CampaignSkeleton } from "@/components/campaign-summary";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QueryError, QueryLoading } from "@/components/query-status";
import { SubmissionTotals, SubmissionsSkeleton, SubmissionsTable } from "@/components/submissions-table";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import type { Submission } from "@/lib/submissions";
import { useApiQuery } from "@/lib/use-api-query";

const BACK = { href: "/brand", label: "All campaigns" };

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

  if (campaign.state.status === "loading") {
    return (
      <QueryLoading label="Loading campaign…">
        <CampaignSkeleton />
      </QueryLoading>
    );
  }

  if (campaign.state.status === "error") {
    const { error } = campaign.state;
    if (error.status === 404 || error.status === 400) {
      return (
        <PageHeader back={BACK} title="Campaign not found" description="There is no campaign at this address in your account." />
      );
    }
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={BACK} title="Campaign" />
        <QueryError title="We couldn't load this campaign" error={error} onRetry={campaign.retry} />
      </div>
    );
  }

  const { campaign: details } = campaign.state.data;
  const posts = submissions.state.status === "success" ? submissions.state.data.submissions : null;

  return (
    <>
      <CampaignHeader campaign={details} back={BACK} />
      <div className="mt-8">
        <CampaignOverview
          campaign={details}
          postViews={posts?.map((post) => post.views)}
          postsCaption="Posts counted under the highest milestone each has reached so far."
        />
      </div>

      <section aria-labelledby="submissions-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 id="submissions-heading" className="text-2xl font-semibold tracking-tight">
            Submissions
          </h2>
          {posts && posts.length > 0 && <SubmissionTotals posts={posts} />}
        </div>
        <div className="mt-4">
          {submissions.state.status === "loading" && (
            <QueryLoading label="Loading submissions…">
              <SubmissionsSkeleton />
            </QueryLoading>
          )}
          {submissions.state.status === "error" && (
            <QueryError
              title="We couldn't load the submissions"
              error={submissions.state.error}
              onRetry={submissions.retry}
            />
          )}
          {posts &&
            (posts.length === 0 ? (
              <EmptyState title={details.status === "live" ? "No posts yet" : "No posts"} headingLevel={3}>
                {details.status === "live"
                  ? "Creators can submit posts while the campaign is live. They appear here with their views and payouts."
                  : "No posts were submitted before the budget ran out."}
              </EmptyState>
            ) : (
              <SubmissionsTable submissions={posts} campaignOf={() => details} labelledBy="submissions-heading" showSpikeFlags />
            ))}
        </div>
      </section>
    </>
  );
}
