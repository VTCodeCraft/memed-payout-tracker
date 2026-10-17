import type { ReactNode } from "react";
import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { highestMilestone } from "@/lib/campaigns";
import { EXAMPLE_BUDGET, EXAMPLE_LADDER, EXAMPLE_POSTS } from "@/lib/example-campaign";
import { formatRupees, formatViews } from "@/lib/format";

interface AudienceRowProps {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  /** What the example shows, for screen readers, since the card repeats the text visually. */
  figureLabel: string;
  figure: ReactNode;
  /** Puts the example first on wide screens, so the two rows alternate. */
  figureFirst?: boolean;
}

function AudienceRow({ id, eyebrow, title, body, points, figureLabel, figure, figureFirst = false }: AudienceRowProps) {
  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId} className="grid scroll-mt-8 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={figureFirst ? "lg:order-last" : undefined}>
        <p className="text-sm font-medium lowercase text-muted">{eyebrow}</p>
        <h2 id={titleId} className="mt-3 text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          {title}
        </h2>
        <p className="mt-4 max-w-xl text-muted text-pretty">{body}</p>
        <ul className="mt-6 max-w-xl divide-y divide-ink/10 border-y border-ink/10">
          {points.map((point) => (
            <li key={point} className="py-3 text-pretty">
              {point}
            </li>
          ))}
        </ul>
      </div>
      <figure aria-label={figureLabel}>{figure}</figure>
    </section>
  );
}

function ExhaustedCampaignExample() {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-semibold tracking-tight">Diwali reels</p>
        <div className="flex gap-2">
          <Badge>Instagram</Badge>
          <Badge tone="ink">Budget exhausted</Badge>
        </div>
      </div>
      <BudgetSummary campaign={{ totalBudget: EXAMPLE_BUDGET, spent: EXAMPLE_BUDGET, remaining: 0 }} />
      <p className="border-t border-ink/10 pt-4 text-sm text-pretty">
        Reel 2 earned <span className="font-semibold tabular-nums">₹5,000</span> when only{" "}
        <span className="font-semibold tabular-nums">₹1,000</span> was left. It was paid ₹1,000, and the other ₹4,000 is
        recorded as unfunded instead of being spent.
      </p>
    </Card>
  );
}

function EarningsExample() {
  const paid = EXAMPLE_POSTS.reduce((sum, post) => sum + post.paid, 0);
  const earned = EXAMPLE_POSTS.reduce((sum, post) => sum + post.earned, 0);
  // The same labels as the creator's real earnings page.
  const figures = [
    { label: "Paid", value: paid },
    { label: "Earned", value: earned },
    { label: "Unfunded", value: earned - paid },
  ];

  return (
    <Card className="flex flex-col gap-5">
      <p className="text-xl font-semibold tracking-tight">My earnings</p>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {figures.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatRupees(value)}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-ink/10 border-t border-ink/10">
        {EXAMPLE_POSTS.map((post) => {
          const unfunded = post.earned - post.paid;
          return (
            <li key={post.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 tabular-nums last:pb-0">
              <div>
                <p className="font-medium">{post.name}</p>
                <p className="text-sm text-muted">
                  {formatViews(post.views)} views · milestone {highestMilestone(post.views, EXAMPLE_LADDER)} of{" "}
                  {EXAMPLE_LADDER.length}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatRupees(post.paid)} paid</span>
                {unfunded > 0 ? (
                  <Badge tone="lime">{formatRupees(unfunded)} unfunded</Badge>
                ) : (
                  <Badge tone="green">Paid in full</Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Two alternating rows: what a brand controls, then what a creator sees. */
export function ForBrandsAndCreators() {
  return (
    <div className="mt-12 flex flex-col gap-16 border-t border-ink pt-10 md:mt-20 md:gap-24 md:pt-12">
      <AudienceRow
        id="for-brands"
        eyebrow="for brands"
        title="Your budget is the most a campaign pays out"
        body="Create a campaign with a budget and up to ten milestones. Its page shows what has been spent, what is left and every post submitted to it."
        points={[
          "Choose Instagram or YouTube, a budget and a milestone ladder.",
          "See each post's views, the milestone it reached and what it was paid.",
          "Once the budget is spent, the campaign stops taking posts and pays nothing more.",
        ]}
        figureLabel="Example: the Diwali reels campaign after its budget ran out"
        figure={<ExhaustedCampaignExample />}
      />
      <AudienceRow
        id="for-creators"
        eyebrow="for creators"
        title="Post once, earn more as the views grow"
        body="Browse the campaigns that still have budget, post on the campaign's platform and submit the link. Your earnings page shows what each post has earned and been paid."
        points={[
          "Instagram campaigns take posts and reels. YouTube campaigns take videos and Shorts.",
          "Each higher milestone a post reaches pays the difference from what it already got.",
          "If a budget runs out first, the rest of what a post earned shows as unfunded.",
        ]}
        figureLabel="Example: a creator's earnings from two reels on the Diwali reels campaign"
        figure={<EarningsExample />}
        figureFirst
      />
    </div>
  );
}
