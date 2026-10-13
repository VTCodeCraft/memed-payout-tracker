import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { createAccount, restoreSession } from "./support";

test.describe("route protection and sessions", () => {
  test("sends a signed-out visitor from each protected page to log in", async ({ page }) => {
    for (const path of ["/brand", "/brand/campaigns/665f1c2e8b3e4a0000000001", "/creator", "/creator/earnings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/login");
      await expect(page.getByRole("heading", { name: "Log in", exact: true })).toBeVisible();
    }
  });

  test("keeps a creator signed in across reloads and keeps them out of brand pages", async ({ page, request }) => {
    await restoreSession(page, await createAccount(request, "creator", "creator@access.e2e.test"));

    await page.goto("/creator/earnings");
    await expect(page.getByRole("heading", { name: "My earnings", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "My earnings", exact: true })).toBeVisible();

    await page.goto("/brand");
    await expect(page).toHaveURL("/creator");
    await expect(page.getByRole("heading", { name: "Live campaigns", exact: true })).toBeVisible();
  });

  test("ends a session the API rejects and says why on the login page", async ({ page, request }) => {
    const session = await createAccount(request, "brand", "brand@expired.e2e.test");
    await restoreSession(page, { ...session, token: `${session.token}tampered` });

    await page.goto("/brand");

    await expect(page).toHaveURL("/login?session=expired");
    await expect(page.getByText("Your session has ended. Log in again to continue.")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("memed.session"))).toBeNull();
  });

  test("logging out in one tab signs the other tab out too", async ({ context, page, request }) => {
    await restoreSession(page, await createAccount(request, "brand", "brand@tabs.e2e.test"));
    await page.goto("/brand");
    const otherTab = await context.newPage();
    await otherTab.goto("/brand");
    await expect(otherTab.getByRole("heading", { name: "Your campaigns", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();

    await expect(otherTab).toHaveURL("/login");
  });

  test("shows another brand's campaign as not found and another creator none of the posts", async ({ page, request }) => {
    const owner = await createAccount(request, "brand", "owner@isolation.e2e.test");
    const created = await request.post(`${API_URL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { name: "Owner's campaign", platform: "youtube", totalBudget: 5_000, milestones: [{ views: 1_000, payout: 100 }] },
    });
    const campaignId = (await created.json()).campaign.id as string;
    const poster = await createAccount(request, "creator", "poster@isolation.e2e.test");
    const posted = await request.post(`${API_URL}/api/submissions`, {
      headers: { Authorization: `Bearer ${poster.token}` },
      data: { campaignId, postUrl: "https://youtu.be/dQw4w9WgXcQ" },
    });
    expect(posted.status()).toBe(201);

    await restoreSession(page, await createAccount(request, "brand", "other-brand@isolation.e2e.test"));
    await page.goto(`/brand/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { name: "Campaign not found", exact: true })).toBeVisible();
    await expect(page.getByText("Owner's campaign")).toHaveCount(0);

    await restoreSession(page, await createAccount(request, "creator", "other-creator@isolation.e2e.test"));
    await page.goto(`/creator/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { name: "Owner's campaign", exact: true })).toBeVisible();
    await expect(page.getByText("You haven't submitted a post to this campaign yet.")).toBeVisible();
    await page.goto("/creator/earnings");
    await expect(page.getByText("You haven't submitted any posts yet.")).toBeVisible();
  });
});
