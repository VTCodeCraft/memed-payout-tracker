import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { apiError, json, stubFetch } from "../../test/fetch.ts";
import { click, render, settle } from "../../test/render.tsx";
import type { Campaign } from "../lib/campaigns.ts";
import { SignedInContext } from "../lib/signed-in.ts";
import type { Earnings, Submission } from "../lib/submissions.ts";
import { CreatorEarnings } from "./creator-earnings.tsx";

const diwali: Campaign = {
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
const launch: Campaign = { ...diwali, id: "665f1c2e8b3e4a0000000003", name: "Launch week", status: "live" };

const post = (id: string, campaignId: string, views: number, eligible: number, paid: number): Submission => ({
  id,
  campaignId,
  platform: "instagram",
  postUrl: `https://instagram.com/p/${id}`,
  normalizedUrl: `https://www.instagram.com/p/${id}/`,
  views,
  eligiblePayout: eligible,
  paidPayout: paid,
  createdAt: "2026-10-13T11:00:00.000Z",
});

const myPosts = [post("CxPartial1", diwali.id, 60000, 2000, 500), post("CxFull0001", launch.id, 12000, 500, 500)];
const earnings: Earnings = { totalPaid: 1000, totalEligible: 2500, totalUnfunded: 1500, submissionCount: 2 };

interface Answers {
  earningsResponse?: () => Response | Promise<Response>;
  mine?: Submission[];
  mineResponse?: () => Response | Promise<Response>;
}

/** Answers like the API: the creator's totals, their posts, and each campaign by id. */
function api({ earningsResponse = () => json(200, { earnings }), mine = myPosts, mineResponse }: Answers = {}) {
  return stubFetch((call) => {
    if (call.url.endsWith("/submissions/earnings")) return earningsResponse();
    if (call.url.endsWith("/submissions/mine")) return mineResponse ? mineResponse() : json(200, { submissions: mine });
    const campaign = [diwali, launch].find(({ id }) => call.url.endsWith(`/campaigns/${id}`));
    return campaign ? json(200, { campaign }) : apiError(404, "NOT_FOUND", "Campaign not found");
  });
}

async function renderPage(expire = () => {}) {
  const session = { token: "token-c", user: { id: "c1", name: "Clip Factory", role: "creator" as const }, expire };
  const view = await render(
    <SignedInContext value={session}>
      <CreatorEarnings />
    </SignedInContext>,
  );
  await settle();
  return view;
}

const rows = (container: Element) =>
  [...container.querySelectorAll("section tbody tr")].map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));

describe("CreatorEarnings", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("asks only for the token holder's totals and posts, then each of their campaigns once", async () => {
    const calls = api();

    await renderPage();

    assert.deepEqual(
      calls.map(({ url }) => url.replace(/^.*\/api\//, "")).sort(),
      ["campaigns/" + diwali.id, "campaigns/" + launch.id, "submissions/earnings", "submissions/mine"].sort(),
    );
    assert.ok(calls.every(({ url, headers }) => !url.includes("?") && headers.Authorization === "Bearer token-c"));
  });

  it("shows paid, earned and unfunded totals and explains how they differ", async () => {
    api();

    const { container } = await renderPage();

    const figures = Object.fromEntries(
      [...container.querySelectorAll("dl > div")].map((item) => [item.querySelector("dt")?.textContent, item.querySelector("dd")?.textContent]),
    );
    assert.deepEqual(figures, { Paid: "₹1,000", Earned: "₹2,500", Unfunded: "₹1,500", Posts: "2" });
    assert.match(container.textContent ?? "", /When a campaign's budget runs out, the rest of what a post earned is unfunded and is not paid/);
  });

  it("lists exactly the posts the API returned, each with its campaign and payout status", async () => {
    api();

    const { container } = await renderPage();

    assert.deepEqual(rows(container), [
      ["Diwali clips", "instagram.com/p/CxPartial1/ (opens in a new tab)", "60,000", "2 of 2", "₹2,000", "₹500", "₹1,500 unfunded"],
      ["Launch week", "instagram.com/p/CxFull0001/ (opens in a new tab)", "12,000", "1 of 2", "₹500", "₹500", "Paid in full"],
    ]);
    assert.equal(container.querySelector("section tbody a")?.getAttribute("href"), `/creator/campaigns/${diwali.id}`);
  });

  it("points a creator with no posts to the live campaigns", async () => {
    api({ earningsResponse: () => json(200, { earnings: { totalPaid: 0, totalEligible: 0, totalUnfunded: 0, submissionCount: 0 } }), mine: [] });

    const { container } = await renderPage();

    assert.match(container.textContent ?? "", /You haven't submitted any posts yet/);
    assert.equal(container.querySelector('section a[href="/creator"]')?.textContent, "Browse live campaigns");
  });

  it("keeps the posts on screen when only the totals fail, with a retry for them", async () => {
    let attempt = 0;
    api({
      earningsResponse: () => (attempt++ === 0 ? Promise.reject(new TypeError("Failed to fetch")) : json(200, { earnings })),
    });

    const { container } = await renderPage();
    assert.match(container.textContent ?? "", /We couldn't load your earnings/);
    assert.equal(rows(container).length, 2);

    await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Try again"));
    await settle();

    assert.match(container.querySelector("dl")?.textContent ?? "", /₹1,000/);
  });

  it("explains when the posts cannot be loaded", async () => {
    api({ mineResponse: () => new Response("<html>Bad Gateway</html>", { status: 502 }) });

    const { container } = await renderPage();

    assert.match(container.querySelector("section")?.textContent ?? "", /We couldn't load your posts/);
    assert.match(container.querySelector("section [role=alert]")?.textContent ?? "", /starting up/);
  });

  it("ends the session on a 401", async () => {
    stubFetch(() => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"));
    let expired = 0;

    const { container } = await renderPage(() => expired++);

    assert.ok(expired >= 1);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});
