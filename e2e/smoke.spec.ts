import { expect, test } from "@playwright/test";

const SKIP_REASON =
  "No server at baseURL. Start with: npm run build && npm start. " +
  "Set PLAYWRIGHT_BASE_URL if it is not http://127.0.0.1:3000. " +
  "Install the browser with: npx playwright install chromium";

test.beforeEach(async ({ request }) => {
  if (process.env.E2E_SERVER_UP === "1") return;
  if (process.env.E2E_SERVER_UP === "0") {
    test.skip(true, SKIP_REASON);
    return;
  }

  let up = false;
  try {
    const response = await request.get("/", { timeout: 4000, failOnStatusCode: false });
    up = response.status() > 0;
  } catch {
    up = false;
  }
  if (!up) console.log(SKIP_REASON);
  test.skip(!up, SKIP_REASON);
});

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Dense papers/ })).toBeVisible();
});

test("post page loads", async ({ page }) => {
  await page.goto("/");
  const postLink = page.locator('a[href^="/posts/"]').first();
  if ((await postLink.count()) > 0) {
    const href = await postLink.getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.goto(href!);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return;
  }

  const response = await page.goto("/posts/missing-smoke-entry");
  expect(response?.status() ?? 0).toBeLessThan(500);
  await expect(page.getByText(/doesn't exist|temporarily unavailable|not on file/i).first()).toBeVisible();
});

test("register form validation rejects a mismatch", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("reader@example.com");
  await page.getByLabel("Password", { exact: true }).fill("sandbox-pw1");
  await page.getByLabel("Confirm password", { exact: true }).fill("sandbox-pw2");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText("Passwords do not match.");
  await expect(page).toHaveURL(/\/register/);

  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty("validity.valid", false);
  await expect(page).toHaveURL(/\/register/);
});

test("admin login rejects a bad password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const alert = page.locator("p[role='alert']");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveText(/invalid email or password|sign in failed|too many failed attempts|could not reach/i);
  await expect(page).toHaveURL(/\/login/);
  await expect(page).not.toHaveURL(/\/admin/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
