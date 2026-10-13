import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

export const PASSWORD = "e2e test password";

type Role = "brand" | "creator";

/** Signs up through the real form; done once the role's home has verified the session. */
export async function signUpInBrowser(page: Page, { name, email, role }: { name: string; email: string; role: Role }) {
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("radio", { name: role === "brand" ? /^Brand/ : /^Creator/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

export async function logInInBrowser(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
}

/** The simulated view feed: PATCH /api/submissions/:id/views takes no authentication. */
export async function reportViews(request: APIRequestContext, submissionId: string, views: number) {
  const response = await request.patch(`${API_URL}/api/submissions/${submissionId}/views`, { data: { views } });
  expect(response.status()).toBe(200);
  return (await response.json()).allocation as { outcome: string; grantedNow: number; unfundedPayout: number };
}

/** The value shown under a figure's label, such as "Paid" on the earnings page. */
export function figure(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");
}
