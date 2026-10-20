import { defineConfig } from "@playwright/test";

/**
 * Smoke tests against an app that is already running. Not part of `npm test`.
 *
 *   npm run build && npm start
 *   npm run test:e2e
 *
 * baseURL is PLAYWRIGHT_BASE_URL, or http://127.0.0.1:3000.
 * If nothing is listening, the suite skips and exits 0.
 *
 * npm ci does not download browsers when PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1.
 * If a browser install hangs, stop it and run exactly:
 *   npx playwright install chromium
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    trace: "off",
  },
});
