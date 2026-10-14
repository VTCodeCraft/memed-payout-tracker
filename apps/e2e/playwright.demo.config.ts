import { defineConfig } from "@playwright/test";
import e2e from "./playwright.config";

// Records the captioned workflow demo in demo/ as a video, on the browser tests' throwaway
// stack (production builds of the API and web app, in-memory MongoDB). Run it with
// `pnpm --filter e2e demo`; the video is written under demo-results/.
export default defineConfig({
  ...e2e,
  testDir: "./demo",
  // Playwright empties a run's output folder before it starts. The browser tests use
  // test-results/, so the demo keeps a sibling folder of its own: neither run can then delete
  // the other's files. Each demo run replaces the previous recording.
  outputDir: "./demo-results",
  use: {
    ...e2e.use,
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
    // A short pause after each action, so the recording can be followed.
    launchOptions: { slowMo: 150 },
  },
});
