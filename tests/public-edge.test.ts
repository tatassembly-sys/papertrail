import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { assertCronAuthorized } from "../lib/cron-auth";
import { exposeDevMailLink } from "../lib/dev-mail-link";
import { GET as suggest } from "../app/api/search/suggest/route";

type Env = { NODE_ENV?: string };

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const env = process.env as Env & Record<string, string | undefined>;
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) previous.set(key, env[key]);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

test("exposeDevMailLink stays off on Vercel production", () => {
  withEnv(
    { NODE_ENV: "production", VERCEL_ENV: "production", E2E_EXPOSE_MAIL_LINKS: "1" },
    () => {
      assert.equal(exposeDevMailLink(), false);
    }
  );
  withEnv({ NODE_ENV: "production", VERCEL_ENV: undefined, E2E_EXPOSE_MAIL_LINKS: undefined }, () => {
    assert.equal(exposeDevMailLink(), false);
  });
  withEnv({ NODE_ENV: "production", VERCEL_ENV: "preview", E2E_EXPOSE_MAIL_LINKS: "1" }, () => {
    assert.equal(exposeDevMailLink(), false);
  });
  withEnv({ NODE_ENV: "production", VERCEL_ENV: undefined, E2E_EXPOSE_MAIL_LINKS: "1" }, () => {
    assert.equal(exposeDevMailLink(), true);
  });
  withEnv({ NODE_ENV: "test", VERCEL_ENV: undefined, E2E_EXPOSE_MAIL_LINKS: undefined }, () => {
    assert.equal(exposeDevMailLink(), true);
  });
});

test("mail routes return links only through exposeDevMailLink", () => {
  for (const file of [
    "app/api/auth/register/route.ts",
    "app/api/auth/resend-verify/route.ts",
    "app/api/auth/forgot-password/route.ts",
    "app/api/newsletter/subscribe/route.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /exposeDevMailLink\(/, file);
  }
});

test("cron bearer: 401 when the secret does not match, 503 when production has none", async () => {
  const url = "https://example.test/api/process-queue";
  withEnv({ CRON_SECRET: "local-test-secret", NODE_ENV: "production" }, () => {
    const missing = assertCronAuthorized(new NextRequest(url));
    assert.equal(missing?.status, 401);
    const wrong = assertCronAuthorized(
      new NextRequest(url, { headers: { authorization: "Bearer nope" } })
    );
    assert.equal(wrong?.status, 401);
    const ok = assertCronAuthorized(
      new NextRequest(url, { headers: { authorization: "Bearer local-test-secret" } })
    );
    assert.equal(ok, null);
  });

  withEnv({ CRON_SECRET: undefined, NODE_ENV: "production" }, () => {
    const denied = assertCronAuthorized(new NextRequest(url));
    assert.equal(denied?.status, 503);
  });
});

test("search suggest: empty, one character, and overlong queries do not hit search", async () => {
  for (const q of ["", " ", "a"]) {
    const res = await suggest(
      new NextRequest(`https://example.test/api/search/suggest?q=${encodeURIComponent(q)}`)
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { suggestions: [] });
  }
  const long = await suggest(
    new NextRequest(`https://example.test/api/search/suggest?q=${"z".repeat(81)}`)
  );
  assert.equal(long.status, 400);
  const body = (await long.json()) as { error?: string };
  assert.match(body.error || "", /too long/i);
});
