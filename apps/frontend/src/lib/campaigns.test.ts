import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { highestMilestone, spentPercent } from "./campaigns.ts";

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

describe("spentPercent", () => {
  it("rounds the share of the budget paid out to a whole percentage", () => {
    assert.equal(spentPercent({ spent: 0, totalBudget: 6000 }), 0);
    assert.equal(spentPercent({ spent: 4500, totalBudget: 6000 }), 75);
    assert.equal(spentPercent({ spent: 1, totalBudget: 3 }), 33);
    assert.equal(spentPercent({ spent: 2500, totalBudget: 2500 }), 100);
  });
});
