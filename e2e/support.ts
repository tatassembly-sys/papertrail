import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

export const SERVER_HELP =
  "No local server at baseURL. Start with: npm run db:memory, then " +
  "HTTPS_PROXY=http://127.0.0.1:9 npm run build && npm start. " +
  "Set E2E_EXPOSE_MAIL_LINKS=1 on that server so log-mode verify links are returned. " +
  "The flag is ignored when VERCEL_ENV=production. " +
  "Do not point account or admin specs at a public host. " +
  "Install the browser with: npx playwright install chromium";

export function isLocalBaseURL(): boolean {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  try {
    const host = new URL(base).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

/** Skip mutating specs unless a local server is up. E2E_REQUIRE=1 fails instead of skipping. */
export async function skipUnlessLocalServer(request: APIRequestContext): Promise<void> {
  if (!isLocalBaseURL()) {
    test.skip(true, "This spec only runs against localhost.");
    return;
  }
  let up = false;
  try {
    const response = await request.get("/", { timeout: 8000, failOnStatusCode: false });
    up = response.status() > 0;
  } catch {
    up = false;
  }
  if (up) return;
  if (process.env.E2E_REQUIRE === "1") throw new Error(SERVER_HELP);
  test.skip(true, SERVER_HELP);
}

/** Unique documentation-range address so e2e runs do not share a rate-limit bucket. */
export function freshClientIp(label: string): string {
  let hash = Date.now() % 65536;
  for (let i = 0; i < label.length; i++) hash = (hash * 33 + label.charCodeAt(i)) >>> 0;
  const second = (hash >>> 8) & 255;
  const third = (hash & 254) + 1;
  return `198.18.${second}.${third}`;
}

export async function expectNoInternalLeak(page: Page): Promise<void> {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/MongoServerError|ECONNREFUSED|node_modules|at async /);
  expect(text).not.toMatch(/password_hash|verify_token|reset_token/);
}
