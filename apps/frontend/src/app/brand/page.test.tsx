import "../../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { apiError, json, stubFetch } from "../../../test/fetch.ts";
import { click, render, settle, typeInto } from "../../../test/render.tsx";
import type { Campaign } from "../../lib/campaigns.ts";
import { SignedInContext } from "../../lib/signed-in.ts";
import BrandDashboard from "./page.tsx";

// Shaped exactly as GET /api/campaigns/mine sends them: newest first.
const live: Campaign = {
  id: "665f1c2e8b3e4a0000000002",
  name: "Diwali clips",
  platform: "instagram",
  totalBudget: 6000,
  spent: 4500,
  remaining: 1500,
  milestones: [
    { views: 10000, payout: 500 },
    { views: 50000, payout: 2000 },
    { views: 100000, payout: 5000 },
  ],
  status: "live",
  createdAt: "2026-10-13T10:00:00.000Z",
};
const exhausted: Campaign = {
  id: "665f1c2e8b3e4a0000000001",
  name: "Launch week",
  platform: "youtube",
  totalBudget: 2500,
  spent: 2500,
  remaining: 0,
  milestones: [{ views: 50000, payout: 2000 }],
  status: "exhausted",
  createdAt: "2026-10-12T10:00:00.000Z",
};

async function renderDashboard(expire = () => {}) {
  const session = { token: "token-1", user: { id: "u1", name: "Acme Snacks", role: "brand" as const }, expire };
  const view = await render(
    <SignedInContext value={session}>
      <BrandDashboard />
    </SignedInContext>,
  );
  await settle();
  return view;
}

const cardFor = (container: Element, name: string) =>
  [...container.querySelectorAll("li")].find((item) => item.querySelector("h2")?.textContent === name);

describe("brand dashboard", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("asks for the brand's own campaigns with its token and shows loading meanwhile", async () => {
    const calls = stubFetch(() => new Promise(() => {}));

    const { container } = await renderDashboard();

    assert.match(calls[0].url, /\/api\/campaigns\/mine$/);
    assert.equal(calls[0].headers.Authorization, "Bearer token-1");
    assert.equal(container.querySelector('[role="status"]')?.textContent, "Loading your campaigns…");
    assert.equal(calls.length, 1);
  });

  it("shows each campaign in the order received, with platform, status and budget", async () => {
    stubFetch(() => json(200, { campaigns: [live, exhausted] }));

    const { container } = await renderDashboard();

    assert.deepEqual(
      [...container.querySelectorAll("h2")].map((heading) => heading.textContent),
      ["Diwali clips", "Launch week"],
    );
    const first = cardFor(container, "Diwali clips");
    const figures = [...(first?.querySelectorAll("dd") ?? [])].map((figure) => figure.textContent);
    assert.deepEqual(figures, ["₹6,000", "₹4,500", "₹1,500"]);
    assert.match(first?.textContent ?? "", /Instagram/);
    assert.match(first?.textContent ?? "", /Live/);
    assert.match(first?.textContent ?? "", /75% of the budget paid out/);
    assert.match(first?.textContent ?? "", /Created 13 Oct 2026/);

    const second = cardFor(container, "Launch week");
    assert.deepEqual(
      [...(second?.querySelectorAll("dd") ?? [])].map((figure) => figure.textContent),
      ["₹2,500", "₹2,500", "₹0"],
    );
    assert.match(second?.textContent ?? "", /YouTube/);
    assert.match(second?.textContent ?? "", /Budget exhausted/);
  });

  it("lists the milestone ladder in order, readable without the arrow", async () => {
    stubFetch(() => json(200, { campaigns: [live] }));

    const { container } = await renderDashboard();

    const steps = [...container.querySelectorAll("ol li")].map((step) => step.textContent);
    assert.deepEqual(steps, [
      "Milestone 1: 10,000 views →pays ₹500",
      "Milestone 2: 50,000 views →pays ₹2,000",
      "Milestone 3: 1,00,000 views →pays ₹5,000",
    ]);
  });

  it("says when the brand has no campaigns yet", async () => {
    stubFetch(() => json(200, { campaigns: [] }));

    const { container } = await renderDashboard();

    assert.equal(container.querySelector("h2")?.textContent, "No campaigns yet");
    assert.equal(container.querySelector("ul"), null);
  });

  it("shows why loading failed and loads again on Try again", async () => {
    let attempt = 0;
    const calls = stubFetch(() =>
      attempt++ === 0 ? Promise.reject(new TypeError("Failed to fetch")) : json(200, { campaigns: [live] }),
    );

    const { container } = await renderDashboard();
    assert.equal(container.querySelector("h2")?.textContent, "We couldn't load your campaigns");
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not reach the server/);

    await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Try again"));
    await settle();

    assert.equal(calls.length, 2);
    assert.equal(container.querySelector("h2")?.textContent, "Diwali clips");
  });

  it("explains a sleeping server and rate limiting with the API's message", async () => {
    for (const [response, expected] of [
      [new Response("<html>Bad Gateway</html>", { status: 502 }), /starting up or unavailable/],
      [apiError(429, "RATE_LIMITED", "Too many requests, please try again later"), /Too many requests/],
    ] as const) {
      stubFetch(() => response);

      const { container, unmount } = await renderDashboard();

      assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", expected);
      unmount();
      mock.restoreAll();
    }
  });

  it("ends the session on a 401 instead of showing an error", async () => {
    stubFetch(() => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"));
    let expired = 0;

    const { container } = await renderDashboard(() => expired++);

    assert.equal(expired, 1);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});

describe("creating a campaign from the dashboard", () => {
  const created: Campaign = {
    id: "665f1c2e8b3e4a0000000003",
    name: "Holi reels",
    platform: "instagram",
    totalBudget: 3000,
    spent: 0,
    remaining: 3000,
    milestones: [{ views: 20000, payout: 1000 }],
    status: "live",
    createdAt: "2026-10-13T12:00:00.000Z",
  };
  const button = (container: Element, label: string) =>
    [...container.querySelectorAll("button")].find((element) => element.textContent === label);

  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("puts the new campaign at the top of the list without reloading it", async () => {
    const calls = stubFetch((call) => (call.method === "POST" ? json(201, { campaign: created }) : json(200, { campaigns: [live] })));
    const { container } = await renderDashboard();

    await click(button(container, "Create campaign"));
    assert.equal(document.activeElement?.textContent, "New campaign");
    await typeInto(container.querySelector('input[name="name"]'), "Holi reels");
    await click(container.querySelector('input[value="instagram"]'));
    await typeInto(container.querySelector('input[name="totalBudget"]'), "3000");
    await typeInto(container.querySelector('input[name="milestones.0.views"]'), "20000");
    await typeInto(container.querySelector('input[name="milestones.0.payout"]'), "1000");
    await click(container.querySelector('form button[type="submit"]'));
    await settle();

    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET", "POST"],
      "the list is not fetched again",
    );
    assert.deepEqual(
      [...container.querySelectorAll("li h2")].map((heading) => heading.textContent),
      ["Holi reels", "Diwali clips"],
    );
    assert.equal(container.querySelector("form"), null);
    const notice = container.querySelector('[role="status"]');
    assert.equal(notice?.textContent, "“Holi reels” is live. Creators can submit posts to it now.");
    assert.equal(document.activeElement, notice);
  });

  it("closes the form on Cancel and returns focus to the button that opened it", async () => {
    stubFetch(() => json(200, { campaigns: [] }));
    const { container } = await renderDashboard();

    await click(button(container, "Create campaign"));
    assert.equal(container.querySelector("h2")?.textContent, "New campaign");
    await click(button(container, "Cancel"));

    assert.equal(container.querySelector("form"), null);
    assert.equal(document.activeElement, button(container, "Create campaign"));
    assert.equal(container.querySelector("h2")?.textContent, "No campaigns yet");
  });
});
