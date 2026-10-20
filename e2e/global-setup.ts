/**
 * Logs a skip reason when nothing is listening. Does not start the app.
 * The running app is: npm run build && npm start
 * Browser install, if it was skipped during npm ci: npx playwright install chromium
 */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  const reason =
    `e2e skipped: no server at ${baseURL}. ` +
    "Start with: npm run build && npm start. " +
    "Set PLAYWRIGHT_BASE_URL when the app is not on port 3000. " +
    "Install the browser with: npx playwright install chromium";

  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(4000) });
    if (response.status > 0) {
      process.env.E2E_SERVER_UP = "1";
      return;
    }
  } catch {
    /* connection refused or timeout */
  }

  process.env.E2E_SERVER_UP = "0";
  console.log(reason);
}
