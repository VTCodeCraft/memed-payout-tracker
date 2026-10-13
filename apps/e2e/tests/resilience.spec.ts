import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { createAccount, restoreSession } from "./support";

// The browser's own network is intercepted here (the API itself is untouched), to show
// what a creator sees when the free-tier API is unreachable, slow, or rejects a token.
const LIVE_CAMPAIGNS = `${API_URL}/api/campaigns/live`;
const CAMPAIGN = "Resilience campaign";

test.describe("failures between the browser and the API", () => {
  // Other tests leave their own live campaigns in the shared database, so these tests look
  // for this one by name rather than expecting an empty list.
  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const brand = await createAccount(api, "brand", "brand@resilience.e2e.test");
    const created = await api.post(`${API_URL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${brand.token}` },
      data: { name: CAMPAIGN, platform: "instagram", totalBudget: 1_000, milestones: [{ views: 1_000, payout: 100 }] },
    });
    expect(created.status()).toBe(201);
    await api.dispose();
  });

  test.beforeEach(async ({ page, request }, testInfo) => {
    // One account per test, named after it, so tests never share or collide on an email.
    const email = `${testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@resilience.e2e.test`;
    await restoreSession(page, await createAccount(request, "creator", email));
  });

  test("explains an unreachable API and recovers on Try again", async ({ page }) => {
    await page.route(LIVE_CAMPAIGNS, (route) => route.abort("connectionrefused"));
    await page.goto("/creator");
    // Next.js adds its own empty role="alert" route announcer, so match the message itself.
    await expect(page.getByRole("alert").filter({ hasText: "Could not reach the server" })).toBeVisible();

    await page.unroute(LIVE_CAMPAIGNS);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { name: CAMPAIGN, exact: true })).toBeVisible();
  });

  test("tells the creator a slow API is probably waking up", async ({ page }) => {
    await page.route(LIVE_CAMPAIGNS, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 7_000));
      await route.continue();
    });
    await page.goto("/creator");

    // The app waits 5 s before calling a request slow, so this must wait longer than that.
    await expect(page.getByText("The server sleeps when idle and can take up to a minute to wake up.")).toBeVisible({
      timeout: 6_500,
    });
    await expect(page.getByRole("heading", { name: CAMPAIGN, exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("ends the session when a page's request comes back 401", async ({ page }) => {
    await page.route(LIVE_CAMPAIGNS, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "TOKEN_EXPIRED", message: "Session expired, please log in again" } }),
      }),
    );
    await page.goto("/creator");

    await expect(page).toHaveURL("/login?session=expired");
    expect(await page.evaluate(() => localStorage.getItem("memed.session"))).toBeNull();
  });
});
