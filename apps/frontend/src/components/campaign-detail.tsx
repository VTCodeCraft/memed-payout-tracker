"use client";

import Link from "next/link";
import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { QueryError, QueryLoading } from "@/components/query-status";
import { type Campaign, PLATFORM_LABELS, STATUS_LABELS, highestMilestone } from "@/lib/campaigns";
import { formatDate, formatRupees, formatViews } from "@/lib/format";
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
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{details.name}</h1>
          <p className="mt-1 text-muted">Created {formatDate(details.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{PLATFORM_LABELS[details.platform]}</Badge>
          <Badge tone={details.status === "live" ? "green" : "ink"}>{STATUS_LABELS[details.status]}</Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Budget</h2>
          <BudgetSummary campaign={details} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Milestone ladder</h2>
          <table className="w-full text-left tabular-nums">
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="pb-2 font-medium">Milestone</th>
                <th scope="col" className="pb-2 font-medium">Views</th>
                <th scope="col" className="pb-2 font-medium">Pays</th>
              </tr>
            </thead>
            <tbody>
              {details.milestones.map(({ views, payout }, index) => (
                <tr key={views} className="border-t border-ink/10">
                  <th scope="row" className="py-2 font-medium">{index + 1}</th>
                  <td className="py-2">{formatViews(views)}</td>
                  <td className="py-2 font-semibold">{formatRupees(payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

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
          {submissions.state.status === "success" && (
            <SubmissionsTable campaign={details} submissions={submissions.state.data.submissions} />
          )}
        </div>
      </section>
    </>
  );
}

function SubmissionsTable({ campaign, submissions }: { campaign: Campaign; submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <p className="text-muted">
        {campaign.status === "live"
          ? "No posts yet. Creators can submit posts while the campaign is live."
          : "No posts were submitted before the budget ran out."}
      </p>
    );
  }

  return (
    // Focusable so keyboard users can scroll the table sideways on narrow screens.
    <div tabIndex={0} role="region" aria-labelledby="submissions-heading" className="overflow-x-auto">
      <table className="w-full min-w-xl text-left tabular-nums">
        <thead className="text-sm text-muted">
          <tr>
            <th scope="col" className="pb-2 pr-4 font-medium">Post</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Views</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Milestone reached</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Earned</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Paid</th>
            <th scope="col" className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => {
            const reached = highestMilestone(submission.views, campaign.milestones);
            const short = submission.eligiblePayout - submission.paidPayout;
            return (
              <tr key={submission.id} className="border-t border-ink/10">
                <td className="py-3 pr-4">
                  <a
                    href={submission.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    {submission.normalizedUrl.replace(/^https:\/\/(www\.)?/, "")}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </td>
                <td className="py-3 pr-4">{formatViews(submission.views)}</td>
                <td className="py-3 pr-4">{reached === 0 ? "None yet" : `${reached} of ${campaign.milestones.length}`}</td>
                <td className="py-3 pr-4">{formatRupees(submission.eligiblePayout)}</td>
                <td className="py-3 pr-4 font-semibold">{formatRupees(submission.paidPayout)}</td>
                <td className="py-3">
                  {submission.eligiblePayout === 0 ? (
                    <Badge>Not yet eligible</Badge>
                  ) : short > 0 ? (
                    <Badge tone="lime">{formatRupees(short)} unfunded</Badge>
                  ) : (
                    <Badge tone="green">Paid in full</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
