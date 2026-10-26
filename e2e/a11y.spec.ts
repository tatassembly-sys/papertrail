import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// M8.3: no serious/critical axe violations on home, a post and register.
// Read-only (GET pages only), so it is safe against production.
test.beforeEach(async ({ request }) => {
  if (process.env.E2E_SERVER_UP === "1") return;
  let up = false;
  try {
    up = (await request.get("/", { timeout: 4000, failOnStatusCode: false })).status() > 0;
  } catch {
    up = false;
  }
  test.skip(!up, "No server at baseURL");
});

async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

for (const path of ["/", "/register"]) {
  test(`axe: ${path} has no serious/critical violations`, async ({ page }) => {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("axe: a post page has no serious/critical violations", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('a[href^="/posts/"]').first().getAttribute("href");
  test.skip(!href, "No published post to check");
  await page.goto(href!);
  expect(await seriousViolations(page)).toEqual([]);
});

// M9.4: dark mode contrast, and no horizontal overflow at 360px.
for (const path of ["/", "/register"]) {
  test(`axe dark mode: ${path} has no serious/critical violations`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("pt-theme", "dark"));
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test(`mobile 360px: ${path} has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
