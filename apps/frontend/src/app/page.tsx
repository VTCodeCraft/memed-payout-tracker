import { AppShell } from "@/components/app-shell";
import { Badge, CampaignStatusBadge, PlatformBadge } from "@/components/badge";
import { BudgetSummary } from "@/components/budget-summary";
import { Card } from "@/components/card";
import { Faq } from "@/components/faq";
import { ForBrandsAndCreators } from "@/components/for-brands-and-creators";
import { Guarantees } from "@/components/guarantees";
import { LandingFooter } from "@/components/landing-footer";
import { LandingNav } from "@/components/landing-nav";
import { LandingSection } from "@/components/landing-section";
import { MilestoneList } from "@/components/milestone-list";
import { PayoutCalculator } from "@/components/payout-calculator";
import { PublicHeaderActions } from "@/components/public-header-actions";
import { StartLinks } from "@/components/start-links";
import { EXAMPLE_BUDGET, EXAMPLE_LADDER } from "@/lib/example-campaign";

// The example on the right is drawn with the same components as the dashboards, so the
// landing page shows the product as it is rather than an illustration of it. It is the
// worked example after its first post reached 60,000 views and was paid ₹2,000.
const HERO_BUDGET = { totalBudget: EXAMPLE_BUDGET, spent: 2_000, remaining: EXAMPLE_BUDGET - 2_000 };

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
    <AppShell
      actions={
        <>
          <LandingNav />
          <PublicHeaderActions />
        </>
      }
      footer={<LandingFooter />}
    >
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

        {/* The campaign as its brand sees it, with one creator's post overlapping its corner:
            both sides of the product, in the worked example's numbers. */}
        <figure aria-label="Example campaign and one of its posts">
          <p className="mb-3 text-sm font-medium lowercase text-muted">example campaign</p>
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xl font-semibold tracking-tight">Diwali reels</p>
              <div className="flex gap-2">
                <PlatformBadge platform="instagram" />
                <CampaignStatusBadge status="live" />
              </div>
            </div>
            <BudgetSummary campaign={HERO_BUDGET} />
            {/* Extra bottom padding: the post below overlaps this much of the card, and no more. */}
            <div className="pb-6">
              <p className="mb-2 text-sm font-semibold">Milestones</p>
              <MilestoneList milestones={EXAMPLE_LADDER} />
            </div>
          </Card>
          <div className="relative mx-3 -mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-ink bg-white p-4 sm:mr-[-0.75rem] sm:ml-auto sm:w-[25rem] lg:-mr-6">
            <div>
              <p className="font-semibold">
                Reel 1 <span className="font-normal text-muted tabular-nums">· 60,000 views</span>
              </p>
              <p className="text-sm text-muted">Passed two milestones, paid the higher</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">₹2,000</span>
              <Badge tone="green">Paid in full</Badge>
            </div>
          </div>
        </figure>
      </section>

      <LandingSection id="how-payouts-work" title="How payouts work" intro="The same three rules apply to every campaign.">
        {/* A connected flow from 1024px: a rule runs from each step's number to the next. */}
        <ol className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {STEPS.map(({ title, body }, index) => (
            <li key={title} className="relative">
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute top-4 -right-4 left-11 hidden h-px bg-ink/25 lg:block" />
              )}
              <span
                aria-hidden="true"
                className="relative grid size-8 place-items-center rounded-full bg-ink text-sm font-semibold text-white tabular-nums"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-balance">{title}</h3>
              <p className="mt-1 max-w-prose text-muted text-pretty">{body}</p>
            </li>
          ))}
        </ol>
      </LandingSection>

      <LandingSection
        id="calculator"
        title="Work out a payout"
        intro="Type a view count to see what one post earns on the example campaign's ladder."
      >
        <PayoutCalculator milestones={EXAMPLE_LADDER} />
      </LandingSection>

      <ForBrandsAndCreators />

      <Guarantees />

      <Faq />

      <section
        aria-labelledby="start-title"
        className="mt-12 flex flex-col gap-8 border-t border-ink pt-10 md:mt-20 md:pt-12 lg:flex-row lg:items-end lg:justify-between"
      >
        <h2 id="start-title" className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Start a campaign, or find one to post for.
        </h2>
        <StartLinks />
      </section>
    </AppShell>
  );
}
