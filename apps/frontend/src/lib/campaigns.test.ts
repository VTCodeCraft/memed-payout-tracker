import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eligiblePayout, highestMilestone, spentPercent } from "./campaigns.ts";

const ladder = [
  { views: 10000, payout: 500 },
  { views: 50000, payout: 2000 },
  { views: 100000, payout: 5000 },
];

describe("highestMilestone", () => {
  it("counts a milestone as reached at exactly its threshold, like the payout engine", () => {
    assert.equal(highestMilestone(9999, ladder), 0);
    assert.equal(highestMilestone(10000, ladder), 1);
    assert.equal(highestMilestone(99999, ladder), 2);
    assert.equal(highestMilestone(250000, ladder), 3);
  });
});

// The same cases as the API's payout engine tests, so the two rules cannot drift apart.
describe("eligiblePayout", () => {
  const cases: [string, number, number][] = [
    ["zero views", 0, 0],
    ["one view below the first threshold", 9_999, 0],
    ["exactly the first threshold", 10_000, 500],
    ["just past the first threshold", 10_001, 500],
    ["one view below the second threshold", 49_999, 500],
    ["exactly the second threshold", 50_000, 2_000],
    ["between the second and third thresholds", 75_000, 2_000],
    ["exactly the highest threshold", 100_000, 5_000],
    ["far beyond the highest threshold", 10_000_000, 5_000],
  ];
  for (const [label, views, payout] of cases) {
    it(`${label} (${views} views) earns ₹${payout}`, () => {
      assert.equal(eligiblePayout(views, ladder), payout);
    });
  }

  it("pays only the highest milestone crossed, never the sum of crossed milestones", () => {
    assert.equal(eligiblePayout(60_000, ladder), 2_000);
  });

  it("handles a single-milestone ladder", () => {
    const single = [{ views: 1_000, payout: 300 }];
    assert.equal(eligiblePayout(999, single), 0);
    assert.equal(eligiblePayout(1_000, single), 300);
  });
});

describe("spentPercent", () => {
  it("rounds the share of the budget paid out to a whole percentage", () => {
    assert.equal(spentPercent({ spent: 0, totalBudget: 6000 }), 0);
    assert.equal(spentPercent({ spent: 4500, totalBudget: 6000 }), 75);
    assert.equal(spentPercent({ spent: 1, totalBudget: 3 }), 33);
    assert.equal(spentPercent({ spent: 2500, totalBudget: 2500 }), 100);
  });
});
