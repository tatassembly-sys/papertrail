/**
 * Self-hosted fonts must load without Google.
 *
 * Offline build (dead proxy — nothing may call fonts.googleapis.com):
 *   HTTPS_PROXY=http://127.0.0.1:9 npm run build
 *
 * Included in `npm run test:e2e`. Safe against any running server (read-only).
 */
import { expect, test } from "@playwright/test";

const SKIP_REASON =
  "No server at baseURL. Start with: npm run build && npm start. " +
  "Offline font build: HTTPS_PROXY=http://127.0.0.1:9 npm run build";

test.beforeEach(async ({ request }) => {
  if (process.env.E2E_SERVER_UP === "1") return;
  let up = false;
  try {
    up = (await request.get("/", { timeout: 8000, failOnStatusCode: false })).status() > 0;
  } catch {
    up = false;
  }
  if (up) return;
  if (process.env.E2E_REQUIRE === "1") throw new Error(SKIP_REASON);
  test.skip(!up, SKIP_REASON);
});

test("home and about load Fraunces and Inter without Google fonts", async ({ page }) => {
  const google: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) google.push(url);
  });

  for (const path of ["/", "/about"]) {
    await page.goto(path);
    const loaded = await page.evaluate(async () => {
      await document.fonts.load("16px Fraunces");
      await document.fonts.load("16px Inter");
      await document.fonts.ready;
      const families = [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replace(/["']/g, ""));
      return {
        families,
        fraunces: document.fonts.check("16px Fraunces"),
        inter: document.fonts.check("16px Inter"),
      };
    });
    expect(google, path).toEqual([]);
    expect(loaded.fraunces, loaded.families.join(",")).toBe(true);
    expect(loaded.inter, loaded.families.join(",")).toBe(true);
    // next/font registers the const names (fraunces, inter). CSS family matching is case-insensitive.
    const names = loaded.families.map((name) => name.toLowerCase());
    expect(names).toEqual(expect.arrayContaining(["fraunces", "inter"]));
  }
});
