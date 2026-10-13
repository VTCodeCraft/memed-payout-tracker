import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

export const PASSWORD = "e2e test password";

type Role = "brand" | "creator";

interface Session {
  token: string;
  user: { id: string; name: string; role: Role };
}

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

/** Creates an account through the API, for tests about what happens after signing in. */
export async function createAccount(request: APIRequestContext, role: Role, email: string): Promise<Session> {
  const response = await request.post(`${API_URL}/api/auth/signup`, {
    data: { name: `E2E ${role}`, email, password: PASSWORD, role },
  });
  expect(response.status()).toBe(201);
  const { token, user } = await response.json();
  return { token, user: { id: user.id, name: user.name, role: user.role } };
}

/**
 * Puts a session in the browser's storage, as an earlier visit would have left it. It is
 * written from the favicon, a same-origin page with no app code: written from an app page,
 * the page could notice the session and redirect while the test is navigating elsewhere.
 */
export async function restoreSession(page: Page, session: Session) {
  await page.goto("/favicon.ico");
  await page.evaluate((value) => localStorage.setItem("memed.session", JSON.stringify(value)), session);
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
