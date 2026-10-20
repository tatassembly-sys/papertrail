import assert from "node:assert/strict";
import { test } from "node:test";
import { getSiteUrl } from "../lib/site-url";

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_STATIC_URL",
] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, run: () => void) {
  const previous = new Map(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of KEYS) {
      const old = previous.get(key);
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
}

test("explicit site URL wins over Vercel and Railway", () => {
  withEnv(
    {
      NEXT_PUBLIC_SITE_URL: "https://example.test/",
      VERCEL_PROJECT_PRODUCTION_URL: "papertrail.vercel.app",
      RAILWAY_PUBLIC_DOMAIN: "old.up.railway.app",
    },
    () => {
      assert.equal(getSiteUrl(), "https://example.test");
    }
  );
});

test("Vercel production host beats the deployment URL and Railway", () => {
  withEnv(
    {
      VERCEL_PROJECT_PRODUCTION_URL: "papertrail.vercel.app",
      VERCEL_URL: "papertrail-git-preview.vercel.app",
      RAILWAY_PUBLIC_DOMAIN: "old.up.railway.app",
    },
    () => {
      assert.equal(getSiteUrl(), "https://papertrail.vercel.app");
    }
  );
});

test("Vercel deployment URL is used when production URL is unset", () => {
  withEnv({ VERCEL_URL: "papertrail-abc123.vercel.app" }, () => {
    assert.equal(getSiteUrl(), "https://papertrail-abc123.vercel.app");
  });
});

test("Railway hosts remain the last fallback", () => {
  withEnv({ RAILWAY_PUBLIC_DOMAIN: "old.up.railway.app" }, () => {
    assert.equal(getSiteUrl(), "https://old.up.railway.app");
  });
  withEnv({ RAILWAY_STATIC_URL: "https://static.up.railway.app/" }, () => {
    assert.equal(getSiteUrl(), "https://static.up.railway.app");
  });
  withEnv({}, () => {
    assert.equal(getSiteUrl(), "http://localhost:3000");
  });
});
