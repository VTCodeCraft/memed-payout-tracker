import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { act } from "react";
import { apiError, json, stubFetch } from "../../test/fetch.ts";
import { render, settle, typeInto } from "../../test/render.tsx";
import type { Campaign } from "../lib/campaigns.ts";
import { SignedInContext } from "../lib/signed-in.ts";
import type { Submission } from "../lib/submissions.ts";
import { CreatorCampaign } from "./creator-campaign.tsx";

const campaign: Campaign = {
  id: "665f1c2e8b3e4a0000000002",
  name: "Diwali clips",
  platform: "instagram",
  totalBudget: 6000,
  spent: 2000,
  remaining: 4000,
  milestones: [
    { views: 10000, payout: 500 },
    { views: 50000, payout: 2000 },
  ],
  status: "live",
  createdAt: "2026-10-13T10:00:00.000Z",
};

const post = (id: string, campaignId: string, views = 0, eligible = 0, paid = 0): Submission => ({
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

interface Answers {
  campaignResponse?: () => Response;
  mine?: Submission[];
  submit?: () => Response | Promise<Response>;
}

/** Answers like the API: the campaign, the creator's own posts, and the POST. */
function api({
  campaignResponse = () => json(200, { campaign }),
  mine = [],
  submit = () => new Promise<Response>(() => {}),
}: Answers = {}) {
  return stubFetch((call) => {
    if (call.method === "POST") return submit();
    if (call.url.endsWith("/submissions/mine")) return json(200, { submissions: mine });
    return campaignResponse();
  });
}

async function renderPage(expire = () => {}) {
  const session = { token: "token-c", user: { id: "c1", name: "Clip Factory", role: "creator" as const }, expire };
  const view = await render(
    <SignedInContext value={session}>
      <CreatorCampaign id={campaign.id} />
    </SignedInContext>,
  );
  await settle();
  return view;
}

const linkField = (container: Element) => container.querySelector<HTMLInputElement>('input[name="postUrl"]');
const submitButton = (container: Element) => container.querySelector<HTMLButtonElement>('form button[type="submit"]');
const yourPosts = (container: Element) =>
  [...container.querySelectorAll("section tbody tr a")].map((link) => link.textContent);

describe("CreatorCampaign", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("loads the campaign and the creator's own posts, never the campaign's full submission list", async () => {
    const calls = api();

    const { container } = await renderPage();

    const paths = calls.map(({ url }) => url.replace(/^.*\/api\//, "")).sort();
    assert.deepEqual(paths, [`campaigns/${campaign.id}`, "submissions/mine"]);
    assert.ok(calls.every(({ headers }) => headers.Authorization === "Bearer token-c"));
    assert.equal(container.querySelector("h1")?.textContent, "Diwali clips");
    assert.match(container.textContent ?? "", /₹4,000/);
  });

  it("shows only this campaign's posts from the creator's list", async () => {
    api({ mine: [post("CxHere0001", campaign.id, 12000, 500, 500), post("CxElsewhere", "665f1c2e8b3e4a0000000009")] });

    const { container } = await renderPage();

    assert.deepEqual(yourPosts(container), ["instagram.com/p/CxHere0001/ (opens in a new tab)"]);
  });

  it("sends one request for two quick submits, then lists the new post without reloading", async () => {
    let answer: (response: Response) => void = () => {};
    const calls = api({ submit: () => new Promise((resolve) => (answer = resolve)) });
    const { container } = await renderPage();
    await typeInto(linkField(container), "https://www.instagram.com/reel/CxNew00001/?igsh=abc");

    await act(async () => {
      submitButton(container)?.click();
      submitButton(container)?.click();
    });
    const posts = calls.filter(({ method }) => method === "POST");
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body, {
      campaignId: campaign.id,
      postUrl: "https://www.instagram.com/reel/CxNew00001/?igsh=abc",
    });
    assert.equal(submitButton(container)?.disabled, true);

    await act(async () => answer(json(201, { submission: post("CxNew00001", campaign.id) })));
    await settle();

    assert.deepEqual(yourPosts(container), ["instagram.com/p/CxNew00001/ (opens in a new tab)"]);
    assert.equal(calls.filter(({ url }) => url.endsWith("/submissions/mine")).length, 1, "no reload");
    assert.equal(linkField(container)?.value, "");
    const notice = container.querySelector(".bg-lime");
    assert.match(notice?.textContent ?? "", /does not check the post itself/);
    assert.equal(document.activeElement, notice);

    await typeInto(linkField(container), "https://www.instagram.com/p/CxNext0001/");
    assert.equal(container.querySelector(".bg-lime"), null, "the notice belongs to the last success only");
  });

  it("puts the API's verdict beside the field and keeps the typed link", async () => {
    api({
      submit: () =>
        json(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: [{ path: "postUrl", message: "must be a link to a single Instagram post or reel, or a YouTube video" }],
          },
        }),
    });
    const { container } = await renderPage();
    await typeInto(linkField(container), "instagram.com/p/CxAbc123");

    await act(async () => submitButton(container)?.click());
    await settle();

    assert.equal(linkField(container)?.value, "instagram.com/p/CxAbc123");
    assert.equal(linkField(container)?.getAttribute("aria-invalid"), "true");
    assert.match(container.textContent ?? "", /must be a link to a single Instagram post or reel/);
    assert.equal(document.activeElement, linkField(container));
  });

  it("keeps the link after a network failure so the creator can retry", async () => {
    api({ submit: () => Promise.reject(new TypeError("Failed to fetch")) });
    const { container } = await renderPage();
    await typeInto(linkField(container), "https://youtu.be/dQw4w9WgXcQ");

    await act(async () => submitButton(container)?.click());
    await settle();

    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not reach the server/);
    assert.equal(linkField(container)?.value, "https://youtu.be/dQw4w9WgXcQ");
    assert.equal(submitButton(container)?.disabled, false);
  });

  it("offers no form once the budget is used up", async () => {
    api({ campaignResponse: () => json(200, { campaign: { ...campaign, status: "exhausted", remaining: 0 } }) });

    const { container } = await renderPage();

    assert.equal(container.querySelector("form"), null);
    assert.match(container.textContent ?? "", /no longer accepts posts/);
  });

  it("shows an unknown campaign as not found, with nothing else", async () => {
    api({ campaignResponse: () => apiError(404, "NOT_FOUND", "Campaign not found") });

    const { container } = await renderPage();

    assert.equal(container.querySelector("h1")?.textContent, "Campaign not found");
    assert.equal(container.querySelector("form"), null);
    assert.equal(container.querySelector("a")?.getAttribute("href"), "/creator");
  });

  it("ends the session when the API rejects the token", async () => {
    api({ submit: () => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again") });
    let expired = 0;
    const { container } = await renderPage(() => expired++);
    await typeInto(linkField(container), "https://www.instagram.com/p/CxAbc123/");

    await act(async () => submitButton(container)?.click());
    await settle();

    assert.equal(expired, 1);
  });
});
