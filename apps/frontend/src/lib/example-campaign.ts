import type { Milestone } from "./campaigns.ts";

// The README's worked example, which the landing page shows at different moments: a ₹6,000
// Instagram campaign and one creator's two reels. Every figure on the page comes from here
// or from the payout rules, so none of them are made up.

export const EXAMPLE_BUDGET = 6_000;

export const EXAMPLE_LADDER: Milestone[] = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 1_00_000, payout: 5_000 },
];

/** The two reels at the end of the example: the second one used up the budget. */
export const EXAMPLE_POSTS = [
  { name: "Reel 1", views: 1_20_000, earned: 5_000, paid: 5_000 },
  { name: "Reel 2", views: 1_50_000, earned: 5_000, paid: 1_000 },
];
