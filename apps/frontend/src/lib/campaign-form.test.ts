import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { ApiError } from "./api-client.ts";
import { type CampaignForm, campaignFailure, campaignFields, checkCampaign, createCampaign } from "./campaign-form.ts";

const rows = (...pairs: [string, string][]) => pairs.map(([views, payout], id) => ({ id, views, payout }));
const valid: CampaignForm = {
  name: "Diwali clips",
  platform: "instagram",
  totalBudget: "6,000",
  milestones: rows(["10,000", "500"], ["50000", "2000"], ["1,00,000", "5,000"]),
};

describe("checkCampaign", () => {
  it("turns a valid form into the API's request body, accepting digit grouping", () => {
    assert.deepEqual(checkCampaign(valid), {
      input: {
        name: "Diwali clips",
        platform: "instagram",
        totalBudget: 6000,
        milestones: [
          { views: 10000, payout: 500 },
          { views: 50000, payout: 2000 },
          { views: 100000, payout: 5000 },
        ],
      },
    });
  });

  it("reports every missing field, keyed the way the API reports them", () => {
    assert.deepEqual(checkCampaign({ name: " ", platform: "", totalBudget: "", milestones: rows(["", ""]) }), {
      problems: {
        name: "is required",
        platform: "choose Instagram or YouTube",
        totalBudget: "is required",
        "milestones.0.views": "is required",
        "milestones.0.payout": "is required",
      },
    });
  });

  it("only accepts whole numbers within the API's limits", () => {
    const cases: [Partial<CampaignForm>, string, string][] = [
      [{ totalBudget: "5000.50" }, "totalBudget", "must be a whole number of rupees"],
      [{ totalBudget: "0" }, "totalBudget", "must be at least 1"],
      [{ totalBudget: "2147483648" }, "totalBudget", "must be at most ₹2,14,74,83,647"],
      [{ milestones: rows(["ten thousand", "500"]) }, "milestones.0.views", "must be a whole number"],
      [{ name: "x".repeat(81) }, "name", "must be at most 80 characters"],
    ];
    for (const [change, field, message] of cases) {
      assert.deepEqual(checkCampaign({ ...valid, ...change }), { problems: { [field]: message } }, field);
    }
  });

  it("puts ladder-order problems on the row that breaks the order", () => {
    const result = checkCampaign({ ...valid, milestones: rows(["50000", "2000"], ["50000", "1500"]) });

    assert.deepEqual(result, {
      problems: {
        "milestones.1.views": "must be more than milestone 1's views",
        "milestones.1.payout": "must be more than milestone 1's payout",
      },
    });
  });

  it("rejects a payout larger than the whole budget", () => {
    const result = checkCampaign({ ...valid, totalBudget: "3000", milestones: rows(["10000", "500"], ["50000", "4000"]) });

    assert.deepEqual(result, { problems: { "milestones.1.payout": "cannot be more than the total budget" } });
  });
});

describe("campaignFields", () => {
  it("lists fields in screen order, with row fields named by the API's paths", () => {
    assert.deepEqual(campaignFields(2), [
      "name",
      "platform",
      "totalBudget",
      "milestones.0.views",
      "milestones.0.payout",
      "milestones.1.views",
      "milestones.1.payout",
      "milestones",
    ]);
  });
});

describe("createCampaign", () => {
  afterEach(() => mock.restoreAll());

  it("posts only the fields a brand controls and returns the stored campaign", async () => {
    const stored = { id: "c1", name: "Diwali clips", spent: 0, status: "live" };
    const calls: { url: string; init?: RequestInit }[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ campaign: stored }), { status: 201 });
    });
    const checked = checkCampaign(valid);
    if (!("input" in checked)) throw new Error("fixture should be valid");

    // Extra keys reaching createCampaign at runtime must still not be sent.
    const tampered = Object.assign({}, checked.input, { brandId: "someone-else", spent: 99, status: "exhausted" });

    const campaign = await createCampaign(tampered, "token-1");

    assert.match(calls[0].url, /\/api\/campaigns$/);
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(Object.keys(JSON.parse(String(calls[0].init?.body))), ["name", "platform", "totalBudget", "milestones"]);
    assert.deepEqual(campaign, stored);
  });
});

describe("campaignFailure", () => {
  const validation = (details: { path: string; message: string }[]) =>
    new ApiError(400, "VALIDATION_ERROR", "Request validation failed", details);

  it("places the API's row and ladder messages beside the matching fields", () => {
    const feedback = campaignFailure(
      validation([
        { path: "milestones.1.views", message: "must be a whole number" },
        { path: "milestones", message: "milestone 2: payout cannot exceed the total budget" },
        { path: "totalBudget", message: "must be at least 1" },
      ]),
    );

    assert.deepEqual(feedback, {
      fields: {
        "milestones.1.views": "must be a whole number",
        milestones: "milestone 2: payout cannot exceed the total budget",
        totalBudget: "must be at least 1",
      },
      message: undefined,
    });
  });

  it("adds a form message for problems the form has no field for", () => {
    const feedback = campaignFailure(validation([{ path: "brandId", message: "unexpected" }]));

    assert.deepEqual(feedback.fields, {});
    assert.match(feedback.message ?? "", /not accepted/);
  });

  it("uses the API's own message for other failures", () => {
    const feedback = campaignFailure(new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again."));

    assert.deepEqual(feedback, { fields: {}, message: "Could not reach the server. Check your connection and try again." });
  });
});
