import { defineConfig, devices } from "@playwright/test";

// Ports away from local development (3000/3001 for Next, 4000 for the API).
export const API_URL = "http://localhost:4100";
export const WEB_URL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests",
  // One test at a time: the API limits sign-ups and log-ins to 20 per client per 15 minutes,
  // and every test here is the same client. Keep the suite's total well under that.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: { baseURL: WEB_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // The server's production build and entrypoint, on a throwaway database.
      command: "pnpm turbo run build --filter=server && node apps/e2e/start-api.mjs",
      cwd: "../..",
      env: { PORT: new URL(API_URL).port, CORS_ORIGINS: WEB_URL },
      url: `${API_URL}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      // A production build of the frontend that calls the API above. NEXT_PUBLIC_API_URL is
      // part of Turbo's build hash, so this build and the normal one are cached separately;
      // clean-frontend-build.mjs makes sure nothing from an earlier build is served.
      command: `node apps/e2e/clean-frontend-build.mjs && pnpm turbo run build --filter=frontend && pnpm --filter frontend start --port ${new URL(WEB_URL).port}`,
      cwd: "../..",
      env: { NEXT_PUBLIC_API_URL: API_URL },
      url: WEB_URL,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
