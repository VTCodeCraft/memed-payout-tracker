import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { act } from "react";
import { apiError, json, stubFetch } from "../../test/fetch.ts";
import { click, render, settle, typeInto } from "../../test/render.tsx";
import type { Campaign } from "../lib/campaigns.ts";
import { SignedInContext } from "../lib/signed-in.ts";
import { CreateCampaignForm } from "./create-campaign-form.tsx";

const brand = { id: "u1", name: "Acme Snacks", role: "brand" as const };

interface FormOptions {
  expire?: () => void;
  onCreated?: (campaign: Campaign) => void;
}

async function renderForm({ expire = () => {}, onCreated = () => {} }: FormOptions = {}) {
  return render(
    <SignedInContext value={{ token: "token-1", user: brand, expire }}>
      <CreateCampaignForm onCreated={onCreated} onCancel={() => {}} />
    </SignedInContext>,
  );
}

const input = (container: Element, name: string) => container.querySelector(`input[name="${name}"]`);
const button = (container: Element, label: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent === label);
const rowLabels = (container: Element) =>
  [...container.querySelectorAll('[role="group"]')].map((group) => group.querySelector("p")?.textContent);

async function fillValidCampaign(container: Element) {
  await typeInto(input(container, "name"), "Diwali clips");
  await click(input(container, "platform"));
  await typeInto(input(container, "totalBudget"), "6,000");
  await typeInto(input(container, "milestones.0.views"), "10,000");
  await typeInto(input(container, "milestones.0.payout"), "500");
}

describe("CreateCampaignForm", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
  });

  it("says how many posts the budget covers at the top milestone, once both read as rupees", async () => {
    const { container } = await renderForm();
    const coverage = () => [...container.querySelectorAll("p")].find((p) => /budget covers/.test(p.textContent ?? ""))?.textContent;
    assert.equal(coverage(), undefined);

    await typeInto(input(container, "totalBudget"), "6,000");
    await typeInto(input(container, "milestones.0.payout"), "2,500");
    assert.equal(coverage(), "The top milestone pays ₹2,500, so this budget covers at least 2 posts that reach it.");

    await typeInto(input(container, "milestones.0.payout"), "7000");
    assert.equal(coverage(), undefined, "no hint when the payout is more than the budget; validation explains that");
  });

  it("adds milestone rows up to ten and removes any row, renumbering the rest", async () => {
    const { container } = await renderForm();
    assert.deepEqual(rowLabels(container), ["Milestone 1"]);
    assert.equal(button(container, "Remove milestone 1"), undefined, "a single row cannot be removed");

    for (let added = 0; added < 9; added++) await click(button(container, "Add milestone"));

    assert.equal(rowLabels(container).length, 10);
    assert.equal(button(container, "Add milestone")?.disabled, true);
    assert.match(container.textContent ?? "", /up to 10 milestones/);

    await click(button(container, "Remove milestone 2"));

    assert.deepEqual(rowLabels(container), Array.from({ length: 9 }, (_, index) => `Milestone ${index + 1}`));
    assert.equal(button(container, "Add milestone")?.disabled, false);
  });

  it("clears row messages when a row is removed, so none sits beside the wrong row", async () => {
    stubFetch(() => new Promise(() => {}));
    const { container } = await renderForm();
    await click(button(container, "Add milestone"));
    await click(button(container, "Create campaign"));
    assert.equal(input(container, "milestones.1.views")?.getAttribute("aria-invalid"), "true");

    await click(button(container, "Remove milestone 1"));

    assert.equal(input(container, "milestones.0.views")?.hasAttribute("aria-invalid"), false);
  });

  it("shows problems beside their fields, focuses the first, and sends nothing", async () => {
    const calls = stubFetch(() => new Promise(() => {}));
    const { container } = await renderForm();
    await click(button(container, "Add milestone"));
    await typeInto(input(container, "milestones.0.views"), "50000");
    await typeInto(input(container, "milestones.1.views"), "10000");

    await click(button(container, "Create campaign"));

    assert.equal(calls.length, 0);
    assert.equal(document.activeElement, input(container, "name"));
    assert.equal(input(container, "milestones.1.views")?.getAttribute("aria-invalid"), "true");
    assert.match(container.textContent ?? "", /must be more than milestone 1's views/);
    assert.match(container.textContent ?? "", /choose Instagram or YouTube/);
  });

  it("sends one request even when submitted twice before React re-renders", async () => {
    const calls = stubFetch(() => new Promise(() => {}));
    const { container } = await renderForm();
    await fillValidCampaign(container);

    await act(async () => {
      button(container, "Create campaign")?.click();
      button(container, "Create campaign")?.click();
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, {
      name: "Diwali clips",
      platform: "instagram",
      totalBudget: 6000,
      milestones: [{ views: 10000, payout: 500 }],
    });
    assert.equal(calls[0].headers.Authorization, "Bearer token-1");
    assert.equal(button(container, "Creating campaign…")?.disabled, true);
    assert.equal(button(container, "Cancel")?.disabled, true);
  });

  it("hands the stored campaign to the dashboard on success", async () => {
    const stored: Campaign = {
      id: "665f1c2e8b3e4a0000000009",
      name: "Diwali clips",
      platform: "instagram",
      totalBudget: 6000,
      spent: 0,
      remaining: 6000,
      milestones: [{ views: 10000, payout: 500 }],
      status: "live",
      createdAt: "2026-10-13T12:00:00.000Z",
    };
    stubFetch(() => json(201, { campaign: stored }));
    const received: Campaign[] = [];
    const { container } = await renderForm({ onCreated: (campaign) => received.push(campaign) });
    await fillValidCampaign(container);

    await click(button(container, "Create campaign"));
    await settle();

    assert.deepEqual(received, [stored]);
  });

  it("shows the API's validation errors beside the fields they belong to", async () => {
    stubFetch(() =>
      json(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: [
            { path: "milestones", message: "milestone 1: payout cannot exceed the total budget" },
            { path: "milestones.0.views", message: "must be at least 1" },
          ],
        },
      }),
    );
    const { container } = await renderForm();
    await fillValidCampaign(container);

    await click(button(container, "Create campaign"));
    await settle();

    assert.equal(input(container, "milestones.0.views")?.getAttribute("aria-invalid"), "true");
    assert.equal(document.activeElement, input(container, "milestones.0.views"));
    const ladder = container.querySelector('fieldset[name="milestones"]');
    const described = (ladder?.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    assert.ok(described.includes("milestone 1: payout cannot exceed the total budget"));
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.equal(button(container, "Create campaign")?.disabled, false);
  });

  it("explains a network failure and lets the brand try again", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const { container } = await renderForm();
    await fillValidCampaign(container);

    await click(button(container, "Create campaign"));
    await settle();

    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not reach the server/);
    assert.equal(button(container, "Create campaign")?.disabled, false);
  });

  it("ends the session when the API rejects the token", async () => {
    stubFetch(() => apiError(401, "TOKEN_EXPIRED", "Session expired, please log in again"));
    let expired = 0;
    const { container } = await renderForm({ expire: () => expired++ });
    await fillValidCampaign(container);

    await click(button(container, "Create campaign"));
    await settle();

    assert.equal(expired, 1);
  });
});
