import { defineConfig } from "@playwright/test";
import e2e from "./playwright.config";

// Records the captioned workflow demo in demo/ as a video, on the browser tests' throwaway
// stack (production builds of the API and web app, in-memory MongoDB). Run it with
// `pnpm --filter e2e demo`; the video is written under test-results/demo/.
export default defineConfig({
  ...e2e,
  testDir: "./demo",
  outputDir: "./test-results/demo",
  use: {
    ...e2e.use,
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
    // A short pause after each action, so the recording can be followed.
    launchOptions: { slowMo: 150 },
  },
});
