/**
 * Account lifecycle on a local production server (`npm run build && npm start`)
 * with `npm run db:memory`. Included in `npm run test:e2e` (playwright testDir is e2e).
 *
 * The server must set E2E_EXPOSE_MAIL_LINKS=1 so a log-mode verify link is returned.
 * That flag does nothing when VERCEL_ENV=production. Leave RESEND_API_KEY unset.
 * Offline font build check: HTTPS_PROXY=http://127.0.0.1:9 npm run build
 *
 * Runs only against localhost. Set E2E_REQUIRE=1 to fail instead of skip when
 * nothing is listening.
 */
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { expectNoInternalLeak, freshClientIp, skipUnlessLocalServer } from "./support";

const PASSWORD = "Correct-horse-battery-9";

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ request, context }, info) => {
  await skipUnlessLocalServer(request);
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": freshClientIp(`${info.title}:${Date.now()}`),
  });
});

function emailFor(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, email: string, name: string): Promise<string> {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password", { exact: true }).fill(PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/auth/register") && res.request().method() === "POST"
    ),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  const body = (await response.json()) as { verifyUrl?: string; error?: string };
  expect(response.status(), body.error || JSON.stringify(body)).toBe(200);
  expect(body.verifyUrl, "set E2E_EXPOSE_MAIL_LINKS=1 on the local server").toContain(
    "/verify-email?token="
  );
  await page.waitForURL(/\/welcome/);
  await expectNoInternalLeak(page);
  const url = new URL(body.verifyUrl!);
  return `${url.pathname}${url.search}`;
}

async function signIn(page: Page, email: string) {
  await page.goto("/user-login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/account/);
  await expect(page.getByRole("heading", { level: 1, name: /Hi,/ })).toBeVisible();
}

async function deleteAccount(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.waitForURL(/\/$/);
}

test("register, verify, sign in, export, and delete", async ({ page }) => {
  const email = emailFor("life");
  const verifyPath = await register(page, email, "Lifecycle Reader");
  await page.goto(verifyPath);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL(/\/account\?verified=1/);
  await expect(page.getByText("Email verified.")).toBeVisible();
  await expectNoInternalLeak(page);

  await page.locator("#main-content").getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/$/);
  await signIn(page, email);

  const [download, exported] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse((res) => res.url().includes("/api/me/export")),
    page.getByRole("link", { name: "Download your data" }).click(),
  ]);
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-disposition"] || "").toContain("paper-trail-export.json");
  expect(download.suggestedFilename()).toBe("paper-trail-export.json");
  const saved = await download.path();
  expect(saved, "download path").toBeTruthy();
  const data = JSON.parse(await readFile(saved!, "utf8")) as { account?: { email?: string } };
  expect(data.account?.email).toBe(email);
  if (!page.url().includes("/account")) await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: /Hi,/ })).toBeVisible();

  await deleteAccount(page);
  await expectNoInternalLeak(page);
});

test("unverified sign-in shows the verification notice", async ({ page }) => {
  const email = emailFor("unverified");
  await register(page, email, "Unverified Reader");
  await page.goto("/account");
  await page.locator("#main-content").getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/$/);
  await signIn(page, email);
  await expect(page.getByText("Email not verified yet. Check your inbox, or send a new link.")).toBeVisible();
  await expectNoInternalLeak(page);
  await deleteAccount(page);
});

test("a bad reset token shows a user-visible error", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText(
    "Invalid or expired reset token, or password too short."
  );
  await expect(page).toHaveURL(/\/reset-password/);
  await expectNoInternalLeak(page);
});

test("cancelling delete leaves the account in place", async ({ page }) => {
  const email = emailFor("cancel");
  await register(page, email, "Cancel Reader");
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: /Hi, Cancel Reader/ })).toBeVisible();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toMatch(/cannot be undone/i);
    dialog.dismiss();
  });
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Hi, Cancel Reader/ })).toBeVisible();
  await expect(page.getByText("Could not delete account.")).toHaveCount(0);
  const me = await page.request.get("/api/me");
  expect(me.status()).toBe(200);
  const body = (await me.json()) as { user?: { email?: string } | null };
  expect(body.user?.email).toBe(email);
  await deleteAccount(page);
});

test("unsigned export and delete are rejected", async ({ request }) => {
  const ip = freshClientIp(`unsigned:${Date.now()}`);
  const headers = { "x-forwarded-for": ip, origin: "http://127.0.0.1:3000" };
  const exported = await request.get("/api/me/export", { headers });
  expect(exported.status()).toBe(401);
  const exportBody = await exported.text();
  expect(exportBody).not.toMatch(/MongoServerError|password_hash|at async /);

  const removed = await request.delete("/api/me", { headers });
  expect(removed.status()).toBe(401);
  const deleteBody = await removed.text();
  expect(deleteBody).not.toMatch(/MongoServerError|password_hash|at async /);

  const me = await request.get("/api/me", { headers });
  expect(me.status()).toBe(200);
  const meBody = (await me.json()) as { user?: unknown };
  expect(meBody.user).toBeNull();
});
