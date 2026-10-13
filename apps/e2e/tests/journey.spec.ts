import { type Page, expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { figure, logInInBrowser, logOut, reportViews, signUpInBrowser } from "./support";

const BRAND = { name: "Acme Snacks", email: "brand@journey.e2e.test", role: "brand" } as const;
const CREATOR = { name: "Clip Factory", email: "creator@journey.e2e.test", role: "creator" } as const;

/** The rows of a table region as arrays of cell text. */
async function tableRows(page: Page, regionName: string) {
  const rows = page.getByRole("region", { name: regionName }).locator("tbody tr");
  return rows.evaluateAll((elements) => elements.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim())));
}

test("a brand's campaign pays a creator's posts up to its budget, and both see the same numbers", async ({ page, request }) => {
  let campaignPath = "";

  await test.step("the brand signs up and creates a campaign with a two-milestone ladder", async () => {
    await signUpInBrowser(page, BRAND);
    await expect(page).toHaveURL("/brand");
    await expect(page.getByRole("heading", { name: "No campaigns yet", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Create campaign" }).click();
    await page.getByLabel("Campaign name").fill("Diwali clips");
    await page.getByRole("radio", { name: "Instagram" }).check();
    await page.getByLabel("Total budget (₹)").fill("2,500");
    await page.getByRole("group", { name: "Milestone 1" }).getByLabel("Views").fill("10,000");
    await page.getByRole("group", { name: "Milestone 1" }).getByLabel("Payout (₹)").fill("500");
    await page.getByRole("button", { name: "Add milestone" }).click();
    await page.getByRole("group", { name: "Milestone 2" }).getByLabel("Views").fill("50,000");
    await page.getByRole("group", { name: "Milestone 2" }).getByLabel("Payout (₹)").fill("2,000");
    await page.locator("form").getByRole("button", { name: "Create campaign" }).click();

    await expect(page.getByText("“Diwali clips” is live. Creators can submit posts to it now.")).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: "Diwali clips" });
    await expect(card.locator("dd")).toHaveText(["₹2,500", "₹0", "₹2,500"]);
    campaignPath = (await card.getByRole("link", { name: "Diwali clips" }).getAttribute("href")) ?? "";
    expect(campaignPath).toMatch(/^\/brand\/campaigns\/[a-f\d]{24}$/);
    await logOut(page);
  });

  const campaignId = campaignPath.split("/").pop();

  await test.step("a creator signs up, finds the campaign live, and submits two posts", async () => {
    await signUpInBrowser(page, CREATOR);
    await expect(page).toHaveURL("/creator");
    await page.getByRole("link", { name: "Diwali clips" }).click();
    await expect(page).toHaveURL(`/creator/campaigns/${campaignId}`);

    const link = page.getByLabel("Post link");
    await link.fill("instagram.com/p/JourneyA1");
    await page.getByRole("button", { name: "Submit post" }).click();
    await expect(page.getByText("must be a link to a single Instagram post or reel, or a YouTube video")).toBeVisible();
    await expect(link).toHaveValue("instagram.com/p/JourneyA1");

    await link.fill("https://www.instagram.com/reel/JourneyA1/?igsh=tracking");
    await page.getByRole("button", { name: "Submit post" }).click();
    await expect(page.getByText(/^Link submitted\./)).toBeVisible();
    await link.fill("https://instagram.com/p/JourneyB2");
    await page.getByRole("button", { name: "Submit post" }).click();
    await expect(page.getByRole("region", { name: "Your posts in this campaign" }).locator("tbody tr")).toHaveCount(2);
  });

  await test.step("the view feed reports views, and payouts stop exactly at the budget", async () => {
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("memed.session") ?? "{}").token as string);
    const mine = await (await request.get(`${API_URL}/api/submissions/mine`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const id = (code: string) => mine.submissions.find((post: { normalizedUrl: string }) => post.normalizedUrl.includes(code)).id;

    expect(await reportViews(request, id("JourneyA1"), 60_000)).toMatchObject({ outcome: "paid", grantedNow: 2_000 });
    expect(await reportViews(request, id("JourneyA1"), 60_000)).toMatchObject({ outcome: "no_change", grantedNow: 0 });
    expect(await reportViews(request, id("JourneyB2"), 60_000)).toMatchObject({ outcome: "partial", grantedNow: 500, unfundedPayout: 1_500 });
    expect(await reportViews(request, id("JourneyB2"), 90_000)).toMatchObject({ outcome: "budget_exhausted", grantedNow: 0 });
  });

  await test.step("on reload the creator sees the exhausted campaign and each post's payout", async () => {
    await page.reload();
    await expect(page.getByText("This campaign's budget is used up, so it no longer accepts posts.")).toBeVisible();
    await expect(page.getByLabel("Post link")).toHaveCount(0);
    expect(await tableRows(page, "Your posts in this campaign")).toEqual([
      ["instagram.com/p/JourneyB2/ (opens in a new tab)", "90,000", "2 of 2", "₹2,000", "₹500", "₹1,500 unfunded"],
      ["instagram.com/p/JourneyA1/ (opens in a new tab)", "60,000", "2 of 2", "₹2,000", "₹2,000", "Paid in full"],
    ]);
  });

  await test.step("the creator's earnings, opened directly, add up to what was paid", async () => {
    await page.goto("/creator/earnings");
    await expect(figure(page, "Paid")).toHaveText("₹2,500");
    await expect(figure(page, "Earned")).toHaveText("₹4,000");
    await expect(figure(page, "Unfunded")).toHaveText("₹1,500");
    await expect(figure(page, "Posts")).toHaveText("2");
    await expect(page.getByRole("region", { name: "Your posts" }).getByRole("link", { name: "Diwali clips" })).toHaveCount(2);

    // The table scrolls sideways inside its own box on a phone. Anything absolutely positioned
    // in it, like the "(opens in a new tab)" labels, must be positioned within that box too, or
    // it escapes the scrolling and, with a long enough link, widens the whole page.
    const escaped = await page.getByRole("table").locator("..").evaluate((box) =>
      [...box.querySelectorAll("*")].filter((el) => getComputedStyle(el).position === "absolute" && !box.contains((el as HTMLElement).offsetParent)).length,
    );
    expect(escaped).toBe(0);
    await logOut(page);
  });

  await test.step("the brand logs back in and sees the same spend and payouts", async () => {
    await logInInBrowser(page, BRAND.email);
    const card = page.getByRole("listitem").filter({ hasText: "Diwali clips" });
    await expect(card.locator("dd")).toHaveText(["₹2,500", "₹2,500", "₹0"]);
    await expect(card.getByText("Budget exhausted")).toBeVisible();

    await page.goto(campaignPath);
    await expect(page.getByRole("heading", { name: "Diwali clips", level: 1 })).toBeVisible();
    expect(await tableRows(page, "Submissions")).toEqual([
      ["instagram.com/p/JourneyB2/ (opens in a new tab)", "90,000", "2 of 2", "₹2,000", "₹500", "₹1,500 unfunded"],
      ["instagram.com/p/JourneyA1/ (opens in a new tab)", "60,000", "2 of 2", "₹2,000", "₹2,000", "Paid in full"],
    ]);
  });
});
