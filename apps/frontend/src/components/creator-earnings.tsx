"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Meter } from "@/components/meter";
import { PageHeader } from "@/components/page-header";
import { QueryError, QueryLoading } from "@/components/query-status";
import { Skeleton } from "@/components/skeleton";
import { SubmissionsSkeleton, SubmissionsTable } from "@/components/submissions-table";
import { formatRupees } from "@/lib/format";
import { useSignedInSession } from "@/lib/signed-in";
import { type Earnings, loadMyPosts } from "@/lib/submissions";
import { useApiQuery, useQuery } from "@/lib/use-api-query";

/**
 * The creator's totals and every post they have submitted. Both come from endpoints that
 * read the creator from the token (GET /submissions/earnings and /submissions/mine), so
 * nothing here can show another creator's posts or money.
 */
export function CreatorEarnings() {
  const session = useSignedInSession();
  const earnings = useApiQuery<{ earnings: Earnings }>("submissions/earnings", session);
  const posts = useQuery("my-posts", loadMyPosts, session);
  const loaded = posts.state.status === "success" ? posts.state.data : null;
  // With no posts the totals are all zero; the empty state below says more than four ₹0s.
  // (Both answers are checked, in case a post arrived between the two requests.)
  const noPosts =
    earnings.state.status === "success" &&
    earnings.state.data.earnings.submissionCount === 0 &&
    !(loaded && loaded.submissions.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="creator dashboard"
        title="My earnings"
        description="What your posts have earned and been paid, across every campaign."
      />

      <div className="mt-8">
        {earnings.state.status === "loading" && (
          <QueryLoading label="Loading your earnings…">
            <Skeleton className="h-56 rounded-2xl" />
          </QueryLoading>
        )}
        {earnings.state.status === "error" && (
          <QueryError title="We couldn't load your earnings" error={earnings.state.error} onRetry={earnings.retry} />
        )}
        {earnings.state.status === "success" && !noPosts && <EarningsSummary earnings={earnings.state.data.earnings} />}
      </div>

      <section aria-labelledby="posts-heading" className={noPosts ? "" : "mt-10"}>
        <h2 id="posts-heading" className={noPosts ? "sr-only" : "text-2xl font-semibold tracking-tight"}>
          Your posts
        </h2>
        <div className={noPosts ? "" : "mt-4"}>
          {posts.state.status === "loading" && (
            <QueryLoading label="Loading your posts…">
              <SubmissionsSkeleton />
            </QueryLoading>
          )}
          {posts.state.status === "error" && (
            <QueryError title="We couldn't load your posts" error={posts.state.error} onRetry={posts.retry} />
          )}
          {loaded && loaded.submissions.length === 0 && (
            <EmptyState
              title="No earnings yet"
              headingLevel={3}
              action={
                <Link href="/creator" className={buttonClasses("primary")}>
                  Browse live campaigns
                </Link>
              }
            >
              <p>You haven&apos;t submitted any posts yet.</p>
              <p className="mt-1">
                Pick a live campaign, post for it on its platform and submit the link. Your posts and what they earn
                appear here.
              </p>
            </EmptyState>
          )}
          {loaded && loaded.submissions.length > 0 && (
            <SubmissionsTable
              submissions={loaded.submissions}
              campaignOf={({ campaignId }) => loaded.campaigns.get(campaignId)}
              campaignHref={(campaignId) => `/creator/campaigns/${campaignId}`}
              labelledBy="posts-heading"
            />
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Paid leads, because it is the only money actually received. The bar splits what posts
 * earned into the part budgets paid and the part left unfunded, so neither earned nor
 * unfunded can be read as paid.
 */
function EarningsSummary({ earnings }: { earnings: Earnings }) {
  const { totalPaid, totalEligible, totalUnfunded, submissionCount } = earnings;
  const share = (amount: number) => (totalEligible > 0 ? (amount / totalEligible) * 100 : 0);

  return (
    <Card className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
      <div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-5">
          <div className="col-span-3">
            <dt className="text-sm font-medium text-muted">Paid</dt>
            <dd className="mt-1 text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">{formatRupees(totalPaid)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Earned</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums md:text-xl">{formatRupees(totalEligible)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Unfunded</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums md:text-xl">{formatRupees(totalUnfunded)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Posts</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums md:text-xl">{String(submissionCount)}</dd>
          </div>
        </dl>
        {totalEligible > 0 && (
          <div className="mt-6">
            <Meter segments={[{ value: share(totalPaid), tone: "green" }, { value: share(totalUnfunded), tone: "lime" }]} className="h-3" />
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted tabular-nums">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-full border border-ink bg-green" />
                {Math.round(share(totalPaid))}% of earnings paid
              </span>
              {totalUnfunded > 0 && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2.5 rounded-full border border-ink bg-lime" />
                  {Math.round(share(totalUnfunded))}% unfunded
                </span>
              )}
            </p>
          </div>
        )}
      </div>
      <div className="rounded-xl bg-canvas p-4 text-sm text-muted md:p-5">
        <p className="mb-2 font-semibold text-ink">How to read this</p>
        <p className="text-pretty">
          <strong className="font-semibold text-ink">Earned</strong> is what your posts&apos; views have reached under each
          campaign&apos;s milestones. <strong className="font-semibold text-ink">Paid</strong> is what campaign budgets have
          actually allocated to you. When a campaign&apos;s budget runs out, the rest of what a post earned is{" "}
          <strong className="font-semibold text-ink">unfunded</strong> and is not paid.
        </p>
      </div>
    </Card>
  );
}
