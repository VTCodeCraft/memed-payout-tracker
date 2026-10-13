import "../../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { apiError, json, stubFetch } from "../../../test/fetch.ts";
import { click, render, settle } from "../../../test/render.tsx";
import type { Campaign } from "../../lib/campaigns.ts";
import { SignedInContext } from "../../lib/signed-in.ts";
import LiveCampaigns from "./page.tsx";

// Shaped exactly as GET /api/campaigns/live sends them: live only, newest first.
const diwali: Campaign = {
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
const launch: Campaign = { ...diwali, id: "665f1c2e8b3e4a0000000001", name: "Launch week", platform: "youtube" };

async function renderPage(expire = () => {}) {
  const session = { token: "token-c", user: { id: "c1", name: "Clip Factory", role: "creator" as const }, expire };
  const view = await render(
    <SignedInContext value={session}>
      <LiveCampaigns />
    </SignedInContext>,
  );
  await settle();
  return view;
}

describe("creator live campaigns", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("asks for live campaigns with the creator's token and shows loading meanwhile", async () => {
    const calls = stubFetch(() => new Promise(() => {}));

    const { container } = await renderPage();

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/campaigns\/live$/);
    assert.equal(calls[0].headers.Authorization, "Bearer token-c");
    assert.equal(container.querySelector('[role="status"]')?.textContent, "Loading live campaigns…");
  });

  it("lists each campaign with its platform, budget left and ladder, linking to the creator's page", async () => {
    stubFetch(() => json(200, { campaigns: [diwali, launch] }));

    const { container } = await renderPage();

    const cards = [...container.querySelectorAll("ul > li")];
    assert.deepEqual(
      cards.map((card) => card.querySelector("h2")?.textContent),
      ["Diwali clips", "Launch week"],
    );
    assert.equal(cards[0].querySelector("h2 a")?.getAttribute("href"), `/creator/campaigns/${diwali.id}`);
    assert.deepEqual(
      [...cards[0].querySelectorAll("dd")].map((figure) => figure.textContent),
      ["₹6,000", "₹2,000", "₹4,000"],
    );
    assert.match(cards[0].textContent ?? "", /Instagram/);
    assert.match(cards[1].textContent ?? "", /YouTube/);
    assert.deepEqual(
      [...cards[0].querySelectorAll("ol li")].map((step) => step.textContent),
      ["Milestone 1: 10,000 views →pays ₹500", "Milestone 2: 50,000 views →pays ₹2,000"],
    );
  });

  it("offers no brand controls", async () => {
    stubFetch(() => json(200, { campaigns: [diwali] }));

    const { container } = await renderPage();

    assert.equal(container.querySelector("button"), null);
    assert.equal(container.querySelector("form"), null);
  });

  it("explains an empty list", async () => {
    stubFetch(() => json(200, { campaigns: [] }));

    const { container } = await renderPage();

    assert.equal(container.querySelector("h2")?.textContent, "No live campaigns right now");
  });

  it("shows why loading failed and loads again on Try again", async () => {
    let attempt = 0;
    const calls = stubFetch(() =>
      attempt++ === 0 ? Promise.reject(new TypeError("Failed to fetch")) : json(200, { campaigns: [diwali] }),
    );

    const { container } = await renderPage();
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not reach the server/);

    await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Try again"));
    await settle();

    assert.equal(calls.length, 2);
    assert.match(container.textContent ?? "", /Diwali clips/);
  });

  it("explains a server that is still waking up", async () => {
    stubFetch(() => new Response("<html>Service Unavailable</html>", { status: 503 }));

    const { container } = await renderPage();

    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /starting up or unavailable/);
  });

  it("ends the session on a 401 instead of showing an error", async () => {
    stubFetch(() => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"));
    let expired = 0;

    const { container } = await renderPage(() => expired++);

    assert.equal(expired, 1);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});
