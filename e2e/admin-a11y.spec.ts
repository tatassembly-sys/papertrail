/**
 * Admin axe (wcag2a/aa) and 360×640 overflow. Local server only.
 * Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to the admin configured on that server.
 * `npm run db:memory` seeds one draft so the bulk-select checkbox is on /admin.
 * Included in `npm run test:e2e`.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { skipUnlessLocalServer } from "./support";

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ request }) => {
  await skipUnlessLocalServer(request);
});

function adminCreds(): { email: string; password: string } {
  const email = process.env.E2E_ADMIN_EMAIL || "";
  const password = process.env.E2E_ADMIN_PASSWORD || "";
  if (!email || !password) {
    if (process.env.E2E_REQUIRE === "1") {
      throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
    }
    test.skip(true, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  }
  return { email, password };
}

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

async function noHorizontalOverflow(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

test("unsigned /admin redirects to the login page", async ({ page }) => {
  const response = await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=/);
  expect(response?.status() ?? 0).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("admin pages have no serious axe issues and do not overflow at 360px", async ({ page }) => {
  const { email, password } = adminCreds();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await expect(page.getByText("Select all drafts on this page")).toBeVisible();

  for (const path of ["/admin", "/admin/status"]) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(path);
    expect(await seriousViolations(page), `${path} mobile`).toEqual([]);
    await noHorizontalOverflow(page);
  }
});
