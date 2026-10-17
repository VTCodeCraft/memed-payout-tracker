import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { MilestoneList } from "@/components/milestone-list";
import { PublicHeaderActions } from "@/components/public-header-actions";
import { StartLinks } from "@/components/start-links";

// The example on the right is drawn with the same components as the dashboards, so the
// landing page shows the product as it is rather than an illustration of it.
const EXAMPLE = {
  totalBudget: 6_000,
  spent: 2_000,
  remaining: 4_000,
  milestones: [
    { views: 10_000, payout: 500 },
    { views: 50_000, payout: 2_000 },
    { views: 100_000, payout: 5_000 },
  ],
};

const STEPS = [
  {
    title: "Brands set the rules",
    body: "A campaign has a budget and a ladder of view milestones, each with its own payout.",
  },
  {
    title: "Creators submit their posts",
    body: "Pick any live campaign, post on its platform, Instagram or YouTube, and submit the link.",
  },
  {
    title: "Views unlock the highest milestone",
    body: "A post earns the payout of the highest milestone its views reach. Nothing is paid twice, and payouts stop when the budget runs out.",
  },
];

export default function Home() {
  return (
    <AppShell actions={<PublicHeaderActions />}>
      <section className="grid items-center gap-12 py-4 md:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="text-sm font-medium lowercase text-muted">meme&apos;d · campaign payout tracker</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance md:text-6xl">
            Get paid for the views your posts earn.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
            Brands fund campaigns with a budget and a ladder of view milestones. Creators submit their posts, and each
            post earns the highest milestone its views reach, until the budget runs out.
          </p>
          <div className="mt-9">
            <StartLinks />
          </div>
        </div>

        <figure aria-label="Example campaign">
          <p className="mb-3 text-sm font-medium lowercase text-muted">example campaign</p>
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xl font-semibold tracking-tight">Diwali reels</p>
              <div className="flex gap-2">
                <Badge>Instagram</Badge>
                <Badge tone="green">Live</Badge>
              </div>
            </div>
            <BudgetSummary campaign={EXAMPLE} />
            <div>
              <p className="mb-2 text-sm font-semibold">Milestones</p>
              <MilestoneList milestones={EXAMPLE.milestones} />
            </div>
            <p className="border-t border-ink/10 pt-4 text-sm text-pretty">
              A post at <span className="font-semibold tabular-nums">60,000 views</span> has passed two milestones and
              earns <span className="font-semibold tabular-nums">₹2,000</span>, the higher one.
            </p>
          </Card>
        </figure>
      </section>

      <section
        id="how-payouts-work"
        aria-labelledby="how-payouts-work-title"
        className="mt-12 grid scroll-mt-8 gap-8 border-t border-ink pt-10 md:mt-20 md:pt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16"
      >
        <div>
          <h2 id="how-payouts-work-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
            How payouts work
          </h2>
          <p className="mt-3 max-w-xs text-muted text-pretty">The same three rules apply to every campaign.</p>
        </div>
        <ol className="divide-y divide-ink/10">
          {STEPS.map(({ title, body }, index) => (
            <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-6 first:pt-0 last:pb-0">
              <span className="text-lg font-semibold text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1 max-w-prose text-muted text-pretty">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
