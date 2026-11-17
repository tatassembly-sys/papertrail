import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SKIP_REASON =
  "No server at baseURL. Start with: npm run db:memory, then npm run build && npm start. " +
  "Install the browser with: npx playwright install chromium";

test.beforeEach(async ({ request }) => {
  if (process.env.E2E_SERVER_UP === "1") return;
  let up = false;
  try {
    up = (await request.get("/", { timeout: 8000, failOnStatusCode: false })).status() > 0;
  } catch {
    up = false;
  }
  if (!up && process.env.E2E_REQUIRE === "1") throw new Error(SKIP_REASON);
  test.skip(!up, SKIP_REASON);
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}`);
}

async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 1;
  });
}

test("exact author search shows one byline and the chip clears", async ({ page }) => {
  await page.goto("/?author=Ann%20Lee&authorExact=1");
  await expect(page.locator('a[href="/posts/night-signals-from-the-cortex"]')).toBeVisible();
  await expect(page.locator('a[href="/posts/smith-catalogue-of-local-glaciers"]')).toHaveCount(0);
  await expect(page.locator('a[href="/posts/how-sleep-clears-the-brain"]')).toHaveCount(0);
  const chip = page.getByRole("link", { name: /Author: Ann Lee/ });
  await expect(chip).toBeVisible();
  await page.waitForLoadState("networkidle");
  await chip.click();
  await expect(page).not.toHaveURL(/author=/);
  await expect(page.locator('a[href="/posts/night-signals-from-the-cortex"]')).toBeVisible();
  await expect(page.locator('a[href="/posts/smith-catalogue-of-local-glaciers"]')).toBeVisible();
  await expect(page.locator('a[href="/posts/how-sleep-clears-the-brain"]')).toBeVisible();
});

test("authors, topics and feeds stay inside the index cap", async ({ page, request }) => {
  await page.goto("/authors");
  const authorLinks = page.locator('a[href^="/authors/"]');
  const authorCount = await authorLinks.count();
  expect(authorCount).toBeGreaterThan(0);
  expect(authorCount).toBeLessThanOrEqual(80);
  await expect(page.locator('a[href="/authors/ann-lee"]')).toBeVisible();

  await page.goto("/authors/ann-lee");
  await expect(page.getByRole("heading", { level: 1, name: "Ann Lee" })).toBeVisible();
  await expect(page.locator('a[href="/posts/night-signals-from-the-cortex"]')).toBeVisible();
  const rss = page.locator("#main-content").getByRole("link", { name: "RSS" });
  const rssHref = await rss.getAttribute("href");
  expect(rssHref).toBeTruthy();
  expect(rssHref).toContain("author");

  await page.goto("/topics");
  const topicLinks = page.locator('a[href^="/topics/"]');
  const topicCount = await topicLinks.count();
  expect(topicCount).toBeGreaterThan(0);
  expect(topicCount).toBeLessThanOrEqual(80);
  await page.goto("/topics/neuroscience");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const topicCards = page.locator('a[href^="/posts/"]');
  expect(await topicCards.count()).toBeLessThanOrEqual(80);

  for (const path of ["/feed", "/feed.xml", rssHref!]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"] || "", path).toContain("xml");
    const body = await response.text();
    expect(body, path).toContain("<rss");
    const parsed = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      return doc.querySelector("parsererror")?.textContent || "";
    }, body);
    expect(parsed, path).toBe("");
  }
});

test("unknown post is a noindex 404 and does not bounce to login", async ({ page }) => {
  const response = await page.goto("/posts/does-not-exist");
  expect(response?.status()).toBe(404);
  expect(page.url()).toContain("/posts/does-not-exist");
  expect(page.url()).not.toContain("/login");
  await expect(page.locator("#main-content").getByText(/not on file/i)).toBeVisible();
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute("content") || "").join(" ")
  );
  expect(robots).toMatch(/noindex/i);
});

test("keyboard search shows a focus ring and opens the first result", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 40; i++) {
    const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    if (label === "Search papers") break;
    await page.keyboard.press("Tab");
  }
  await expect(page.locator("[data-search-input]")).toBeFocused();
  expect(await focusRing(page)).toBe(true);
  await page.keyboard.type("sleep");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/[?&]q=sleep/);
  await expect(page.locator('a[href^="/posts/"]').first()).toBeVisible();
  await page.locator("[data-search-input]").focus();
  for (let i = 0; i < 80; i++) {
    const href = await page.evaluate(() => document.activeElement?.getAttribute("href") || "");
    if (href.startsWith("/posts/")) break;
    await page.keyboard.press("Tab");
  }
  const href = await page.evaluate(() => document.activeElement?.getAttribute("href") || "");
  expect(href.startsWith("/posts/")).toBe(true);
  expect(await focusRing(page)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/posts\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

for (const path of ["/authors", "/topics", "/?q=sleep"]) {
  test(`axe: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  });
}
