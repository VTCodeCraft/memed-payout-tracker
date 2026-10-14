import { type Locator, type Page, expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { PASSWORD, figure, logOut } from "../tests/support";

// A captioned walk through the main workflow, recorded by playwright.demo.config.ts
// (`pnpm --filter e2e demo`). It runs on the browser tests' throwaway stack, never on the live
// site. Every step is asserted, so the recording can only show what the app actually did.

const BRAND = { name: "Acme Snacks", email: "brand@demo.test" };
const CREATOR = { name: "Clip Factory", email: "creator@demo.test" };
const POSTS = ["DemoReelA1", "DemoReelB2", "DemoReelC3"] as const;

// The caption bar is the demo's narration, drawn over the app rather than part of it: it hangs
// off <html>, outside the React root, ignores the pointer and is hidden from assistive tech.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const add = () => {
      if (document.getElementById("demo-caption")) return;
      const bar = document.createElement("div");
      bar.id = "demo-caption";
      bar.hidden = true;
      bar.setAttribute("aria-hidden", "true");
      Object.assign(bar.style, {
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        width: "min(1120px, calc(100% - 32px))",
        boxSizing: "border-box",
        padding: "12px 20px",
        borderRadius: "12px",
        background: "rgba(19, 19, 19, 0.9)",
        color: "#fff",
        font: "500 19px/1.45 system-ui, sans-serif",
        textAlign: "center",
        zIndex: "2147483647",
        pointerEvents: "none",
      });
      // Blank room below the page, so a short page can still scroll its content clear of the bar.
      const room = document.createElement("div");
      room.setAttribute("aria-hidden", "true");
      room.style.height = "96px";
      document.documentElement.append(bar, room);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
    else add();
  });
});

/** Shows a caption for long enough to read it (an empty one hides the bar). */
async function caption(page: Page, text: string) {
  await page.evaluate((value) => {
    const bar = document.getElementById("demo-caption");
    if (!bar) return;
    bar.textContent = value;
    bar.hidden = value === "";
  }, text);
  if (text) await page.waitForTimeout(Math.max(3_500, text.length * 65));
}

async function type(field: Locator, text: string) {
  await field.click();
  await field.pressSequentially(text, { delay: 35 });
}

/** Scrolls something to the top of the window, clear of the caption bar along the bottom. */
async function show(locator: Locator) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "start", behavior: "smooth" }));
  await locator.page().waitForTimeout(600);
}

async function signUp(page: Page, person: { name: string; email: string }, role: "Brand" | "Creator") {
  await page.goto("/signup");
  await caption(page, role === "Brand" ? "1. A brand signs up." : "3. A creator signs up in another session.");
  await type(page.getByLabel("Name", { exact: true }), person.name);
  await type(page.getByLabel("Email"), person.email);
  await type(page.getByLabel("Password", { exact: true }), PASSWORD);
  await page.getByRole("radio", { name: new RegExp(`^${role}`) }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await type(page.getByLabel("Email"), email);
  await type(page.getByLabel("Password", { exact: true }), PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

/** Logs out, clearing the caption first so it does not linger over the next screen. */
async function signOut(page: Page) {
  await caption(page, "");
  await logOut(page);
}

/** The simulated platform feed: the API's unauthenticated view-update endpoint. */
async function reportViews(page: Page, submissionId: string, views: number) {
  const response = await page.request.patch(`${API_URL}/api/submissions/${submissionId}/views`, { data: { views } });
  expect(response.status()).toBe(200);
  return (await response.json()).allocation as { grantedNow: number; unfundedPayout: number; outcome: string };
}

test("a brand funds a campaign and a creator is paid within its budget", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const card = page.getByRole("listitem").filter({ hasText: "Diwali Reels" });
  const submissions = (name: string) => page.getByRole("region", { name }).locator("tbody tr");

  await page.goto("/");
  await caption(page, "Meme'd Payout Tracker: brands fund campaigns with a milestone ladder, and creators earn as their posts' views grow.");
  await caption(page, "This recording runs production builds on a throwaway local database. Nothing here touches the live site.");

  // 1-2. The brand signs up and creates a campaign.
  await signUp(page, BRAND, "Brand");
  await expect(page.getByRole("heading", { name: "No campaigns yet" })).toBeVisible();
  await caption(page, "2. The brand creates a campaign: a ₹6,000 budget and a ladder of three milestones.");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await type(page.getByLabel("Campaign name"), "Diwali Reels");
  await page.getByRole("radio", { name: "Instagram" }).check();
  await type(page.getByLabel("Total budget (₹)"), "6,000");
  const ladder = [["10,000", "500"], ["50,000", "2,000"], ["1,00,000", "5,000"]] as const;
  for (const [index, [views, payout]] of ladder.entries()) {
    if (index > 0) await page.getByRole("button", { name: "Add milestone" }).click();
    const milestone = page.getByRole("group", { name: `Milestone ${index + 1}` });
    await type(milestone.getByLabel("Views"), views);
    await type(milestone.getByLabel("Payout (₹)"), payout);
  }
  await page.locator("form").getByRole("button", { name: "Create campaign" }).click();
  await expect(page.getByText("“Diwali Reels” is live. Creators can submit posts to it now.")).toBeVisible();
  await expect(card.locator("dd")).toHaveText(["₹6,000", "₹0", "₹6,000"]);
  await show(card);
  await caption(page, "The campaign is live, with its budget, spend and remaining amount. A post earns the payout of the highest milestone its views reach.");
  await signOut(page);

  // 3. A creator browses live campaigns and submits post links.
  await signUp(page, CREATOR, "Creator");
  await expect(card).toBeVisible();
  await caption(page, "The creator sees every live campaign. Clicking anywhere on the card opens it.");
  await card.click();
  await caption(page, "");
  await expect(page.getByRole("heading", { name: "Diwali Reels", level: 1 })).toBeVisible();
  await show(page.getByRole("heading", { name: "Submit a post" }));
  await caption(page, "The creator submits the link to their Instagram reel.");
  const link = page.getByLabel("Post link");
  await type(link, `https://www.instagram.com/reel/${POSTS[0]}/`);
  await page.getByRole("button", { name: "Submit post" }).click();
  await expect(page.getByText(/^Link submitted\./)).toBeVisible();
  await caption(page, "Two more posts for the same campaign, to show later what happens when the budget runs low.");
  for (const code of POSTS.slice(1)) {
    await link.fill(`https://www.instagram.com/p/${code}/`);
    await page.getByRole("button", { name: "Submit post" }).click();
    await expect(page.getByText(/^Link submitted\./)).toBeVisible();
  }
  await expect(submissions("Your posts in this campaign")).toHaveCount(3);
  // Submission ids for the simulated feed, read with the creator's own session (never shown).
  const ids: Record<string, string> = await page.evaluate(async (api) => {
    const { token } = JSON.parse(localStorage.getItem("memed.session") ?? "{}");
    const { submissions } = await (await fetch(`${api}/api/submissions/mine`, { headers: { Authorization: `Bearer ${token}` } })).json();
    return Object.fromEntries(submissions.map((s: { id: string; normalizedUrl: string }) => [s.normalizedUrl.split("/p/")[1]?.replace("/", ""), s.id]));
  }, API_URL);
  await signOut(page);

  // 4. The brand reviews the submissions.
  await logIn(page, BRAND.email);
  await card.click();
  await caption(page, "");
  await expect(submissions("Submissions")).toHaveCount(3);
  await show(page.getByRole("region", { name: "Submissions" }).first());
  await caption(page, "4. The brand reviews the three submissions on its campaign page. None has views yet.");

  // 5-6. View updates arrive and payouts come out of the budget.
  await caption(page, "5. Views come from the platforms. Here a script plays that feed through the API (PATCH /api/submissions/:id/views); there is no button for it.");
  expect(await reportViews(page, ids[POSTS[0]]!, 60_000)).toMatchObject({ grantedNow: 2_000, outcome: "paid" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Budget", level: 2 }).locator("..").locator("dd")).toHaveText(["₹6,000", "₹2,000", "₹4,000"]);
  await show(page.getByRole("region", { name: "Submissions" }).first());
  await caption(page, "Post A reached 60,000 views. It passed two milestones but earns only the higher one: ₹2,000, paid from the budget.");
  await show(page.getByRole("heading", { name: "Budget", level: 2 }));
  await caption(page, "6. The campaign has now spent ₹2,000 and has ₹4,000 left.");

  expect(await reportViews(page, ids[POSTS[0]]!, 120_000)).toMatchObject({ grantedNow: 3_000, outcome: "paid" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Budget", level: 2 }).locator("..").locator("dd")).toHaveText(["₹6,000", "₹5,000", "₹1,000"]);
  await caption(page, "At 1,20,000 views Post A reaches the ₹5,000 milestone. Only the ₹3,000 difference is paid, leaving ₹1,000.");

  // 8. Two updates compete for the last ₹1,000 at the same moment.
  await caption(page, "Now posts B and C both report 1,20,000 views at the same moment. Each has earned ₹5,000, but only ₹1,000 is left.");
  const race = await Promise.all([reportViews(page, ids[POSTS[1]]!, 120_000), reportViews(page, ids[POSTS[2]]!, 120_000)]);
  expect(race.map((allocation) => allocation.grantedNow).sort((a, b) => a - b)).toEqual([0, 1_000]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Budget", level: 2 }).locator("..").locator("dd")).toHaveText(["₹6,000", "₹6,000", "₹0"]);
  await expect(page.getByText("Budget exhausted")).toBeVisible();
  await show(page.getByRole("region", { name: "Submissions" }).first());
  await caption(page, "One update got the last ₹1,000 and the other got nothing: the campaign spent exactly ₹6,000, never more, and is now exhausted.");
  await caption(page, "Each post shows what its views earned, what was paid, and what was left unfunded.");
  await signOut(page);

  // 7. The creator's earnings agree with the campaign.
  await logIn(page, CREATOR.email);
  await page.getByRole("link", { name: "My earnings" }).click();
  await expect(figure(page, "Paid")).toHaveText("₹6,000");
  await expect(figure(page, "Earned")).toHaveText("₹15,000");
  await expect(figure(page, "Unfunded")).toHaveText("₹9,000");
  await expect(figure(page, "Posts")).toHaveText("3");
  await show(page.locator("main dl").first());
  await caption(page, "7. The creator's earnings: ₹6,000 paid, ₹15,000 earned by views, and ₹9,000 the budget could not cover.");
  await page.getByRole("link", { name: "Live campaigns" }).click();
  await expect(page.getByRole("heading", { name: "No live campaigns right now" })).toBeVisible();
  await caption(page, "The exhausted campaign no longer appears among live campaigns.");
  await caption(page, "Highest-milestone payouts, never beyond the budget, with the same figures for brand and creator.");
  await caption(page, "");
});
