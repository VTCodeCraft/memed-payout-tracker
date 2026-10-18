import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { apiError, json, stubFetch } from "../../test/fetch.ts";
import { click, render, settle } from "../../test/render.tsx";
import type { Campaign } from "../lib/campaigns.ts";
import { SignedInContext } from "../lib/signed-in.ts";
import type { Submission } from "../lib/submissions.ts";
import { CampaignDetail } from "./campaign-detail.tsx";

const campaign: Campaign = {
  id: "665f1c2e8b3e4a0000000002",
  name: "Diwali clips",
  platform: "instagram",
  totalBudget: 2500,
  spent: 2500,
  remaining: 0,
  milestones: [
    { views: 10000, payout: 500 },
    { views: 50000, payout: 2000 },
  ],
  status: "exhausted",
  createdAt: "2026-10-13T10:00:00.000Z",
};

const submission = (id: string, views: number, eligiblePayout: number, paidPayout: number): Submission => ({
  id,
  campaignId: campaign.id,
  platform: "instagram",
  postUrl: `instagram.com/p/${id}`,
  normalizedUrl: `https://www.instagram.com/p/${id}/`,
  views,
  eligiblePayout,
  paidPayout,
  createdAt: "2026-10-13T11:00:00.000Z",
});

type Answer = () => Response | Promise<Response>;

function answer(campaignResponse: Answer, submissionsResponse: Answer) {
  return stubFetch((call) => (call.url.endsWith("/submissions") ? submissionsResponse() : campaignResponse()));
}

async function renderDetail(id = campaign.id, expire = () => {}) {
  const view = await render(
    <SignedInContext value={{ token: "token-1", user: { id: "u1", name: "Acme Snacks", role: "brand" }, expire }}>
      <CampaignDetail id={id} />
    </SignedInContext>,
  );
  await settle();
  return view;
}

const rows = (container: Element) =>
  [...container.querySelectorAll("section tbody tr")].map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));

describe("CampaignDetail", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("loads the campaign and its submissions with the brand's token", async () => {
    const calls = answer(
      () => json(200, { campaign }),
      () => json(200, { submissions: [] }),
    );

    await renderDetail();

    assert.deepEqual(
      calls.map(({ url }) => url.replace(/^.*\/api\//, "")).sort(),
      [`campaigns/${campaign.id}`, `campaigns/${campaign.id}/submissions`],
    );
    assert.ok(calls.every(({ headers }) => headers.Authorization === "Bearer token-1"));
  });

  it("shows the budget, the ladder and how each post was paid", async () => {
    answer(
      () => json(200, { campaign }),
      () =>
        json(200, {
          submissions: [
            submission("CxPartial1", 60000, 2000, 500),
            submission("CxFull0001", 12000, 500, 500),
            submission("CxNone0001", 900, 0, 0),
          ],
        }),
    );

    const { container } = await renderDetail();

    assert.equal(container.querySelector("h1")?.textContent, "Diwali clips");
    assert.match(container.textContent ?? "", /Budget exhausted/);
    assert.deepEqual(
      [...container.querySelectorAll("dd")].map((figure) => figure.textContent),
      ["₹2,500", "₹2,500", "₹0"],
    );
    assert.deepEqual(rows(container), [
      ["instagram.com/p/CxPartial1/ (opens in a new tab)", "60,000", "2 of 2", "₹2,000", "₹500", "₹1,500 unfunded"],
      ["instagram.com/p/CxFull0001/ (opens in a new tab)", "12,000", "1 of 2", "₹500", "₹500", "Paid in full"],
      ["instagram.com/p/CxNone0001/ (opens in a new tab)", "900", "None yet", "₹0", "₹0", "Not yet eligible"],
    ]);
    const link = container.querySelector<HTMLAnchorElement>("section tbody a");
    assert.equal(link?.getAttribute("href"), "https://www.instagram.com/p/CxPartial1/");
    assert.equal(link?.rel, "noopener noreferrer");
  });

  it("flags posts whose views grew unusually fast, and explains the flag", async () => {
    const spike = { detectedAt: "2026-10-13T12:00:00.000Z", fromViews: 0, toViews: 60000, viewsPerHour: 60000 };
    answer(
      () => json(200, { campaign }),
      () => json(200, { submissions: [{ ...submission("CxSpiked01", 60000, 2000, 2000), viewSpike: spike }, submission("CxSteady01", 900, 0, 0)] }),
    );

    const { container } = await renderDetail();

    assert.deepEqual(
      rows(container).map((cells) => cells.at(-1)),
      ["Paid in full Fast growth", "Not yet eligible"],
    );
    assert.match(container.querySelector("section")?.textContent ?? "", /it never changes a payout/);
  });

  it("says why a campaign has no posts", async () => {
    answer(
      () => json(200, { campaign }),
      () => json(200, { submissions: [] }),
    );

    const { container } = await renderDetail();

    assert.match(container.querySelector("section")?.textContent ?? "", /No posts were submitted before the budget ran out/);
  });

  it("shows another brand's campaign, or a malformed id, as not found", async () => {
    for (const response of [
      () => apiError(404, "NOT_FOUND", "Campaign not found"),
      () =>
        json(400, {
          error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: [{ path: "id", message: "must be a valid id" }] },
        }),
    ]) {
      answer(response, response);

      const { container, unmount } = await renderDetail();

      assert.equal(container.querySelector("h1")?.textContent, "Campaign not found");
      assert.equal(container.querySelector("a")?.getAttribute("href"), "/brand");
      assert.equal(container.querySelector("button"), null, "nothing to retry");
      unmount();
      mock.restoreAll();
    }
  });

  it("puts the id into the request path safely", async () => {
    const calls = answer(
      () => apiError(404, "NOT_FOUND", "Campaign not found"),
      () => apiError(404, "NOT_FOUND", "Campaign not found"),
    );

    await renderDetail("../auth/me");

    assert.ok(calls.every(({ url }) => url.includes("/api/campaigns/..%2Fauth%2Fme")));
  });

  it("offers Try again when the campaign cannot be loaded", async () => {
    let attempt = 0;
    answer(
      () => (attempt++ === 0 ? new Response("<html>Bad Gateway</html>", { status: 502 }) : json(200, { campaign })),
      () => json(200, { submissions: [] }),
    );

    const { container } = await renderDetail();
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /starting up/);

    await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Try again"));
    await settle();

    assert.equal(container.querySelector("h1")?.textContent, "Diwali clips");
  });

  it("still shows the campaign when only its submissions fail to load", async () => {
    answer(
      () => json(200, { campaign }),
      () => Promise.reject(new TypeError("Failed to fetch")),
    );

    const { container } = await renderDetail();

    assert.equal(container.querySelector("h1")?.textContent, "Diwali clips");
    assert.match(container.querySelector("section")?.textContent ?? "", /We couldn't load the submissions/);
  });

  it("ends the session on a 401", async () => {
    answer(
      () => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"),
      () => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"),
    );
    let expired = 0;

    const { container } = await renderDetail(campaign.id, () => expired++);

    assert.ok(expired >= 1);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});
