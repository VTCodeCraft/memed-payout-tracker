"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { Card } from "@/components/card";
import { QueryError, QueryLoading } from "@/components/query-status";
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

  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">creator dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">My earnings</h1>

      <div className="mt-8">
        {earnings.state.status === "loading" && <QueryLoading label="Loading your earnings…" />}
        {earnings.state.status === "error" && (
          <QueryError title="We couldn't load your earnings" error={earnings.state.error} onRetry={earnings.retry} />
        )}
        {earnings.state.status === "success" && <EarningsSummary earnings={earnings.state.data.earnings} />}
      </div>

      <section aria-labelledby="posts-heading" className="mt-10">
        <h2 id="posts-heading" className="text-2xl font-semibold tracking-tight">
          Your posts
        </h2>
        <div className="mt-4">
          {posts.state.status === "loading" && (
            <QueryLoading label="Loading your posts…">
              <SubmissionsSkeleton />
            </QueryLoading>
          )}
          {posts.state.status === "error" && (
            <QueryError title="We couldn't load your posts" error={posts.state.error} onRetry={posts.retry} />
          )}
          {loaded && loaded.submissions.length === 0 && (
            <div className="flex flex-col items-start gap-4">
              <p className="text-muted">You haven&apos;t submitted any posts yet.</p>
              <Link href="/creator" className={buttonClasses("secondary")}>
                Browse live campaigns
              </Link>
            </div>
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

function EarningsSummary({ earnings }: { earnings: Earnings }) {
  const figures = [
    { label: "Paid", value: formatRupees(earnings.totalPaid) },
    { label: "Earned", value: formatRupees(earnings.totalEligible) },
    { label: "Unfunded", value: formatRupees(earnings.totalUnfunded) },
    { label: "Posts", value: String(earnings.submissionCount) },
  ];

  return (
    <Card>
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {figures.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums md:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-3xl text-sm text-muted">
        <strong className="font-semibold text-ink">Earned</strong> is what your posts&apos; views have reached under each
        campaign&apos;s milestones. <strong className="font-semibold text-ink">Paid</strong> is what campaign budgets have
        actually allocated to you. When a campaign&apos;s budget runs out, the rest of what a post earned is{" "}
        <strong className="font-semibold text-ink">unfunded</strong> and is not paid.
      </p>
    </Card>
  );
}
