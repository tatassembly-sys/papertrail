import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { postPageMetadata } from "../lib/post-metadata";
import { MISSING_POST_HTML, postProbeStatus } from "../lib/post-probe";
import { runningCommitSha, runningDeploymentEnv } from "../lib/running-commit";

test("missing post metadata is not indexable", () => {
  const meta = postPageMetadata(null, "https://example.test");
  assert.equal(meta.title, "Not on file");
  assert.deepEqual(meta.robots, { index: false, follow: false });
});

test("published post metadata uses the site URL", () => {
  const meta = postPageMetadata(
    { slug: "alpha", title: "Alpha", headline: "A note" },
    "https://example.test/"
  );
  assert.equal(meta.title, "Alpha");
  assert.equal(meta.alternates?.canonical, "https://example.test/posts/alpha");
});

test("a missing published note probes as 404", () => {
  assert.equal(postProbeStatus(false), 404);
  assert.equal(postProbeStatus(true), 204);
  assert.match(MISSING_POST_HTML, /not on file/);
});

test("post route has no loading shell that would lock HTTP 200", () => {
  assert.equal(existsSync("app/posts/[slug]/loading.tsx"), false);
  assert.equal(existsSync("app/loading.tsx"), false);
  assert.equal(existsSync("app/(home)/loading.tsx"), true);
  assert.equal(existsSync("app/(home)/page.tsx"), true);
});

test("public article routes stay outside the admin session matcher", () => {
  const src = readFileSync("middleware.ts", "utf8");
  assert.equal(src.includes("/posts/"), false);
});

const COMMIT_KEYS = ["VERCEL_GIT_COMMIT_SHA", "RAILWAY_GIT_COMMIT_SHA", "VERCEL_ENV"] as const;

function withCommitEnv(values: Partial<Record<(typeof COMMIT_KEYS)[number], string>>, run: () => void) {
  const previous = new Map(COMMIT_KEYS.map((key) => [key, process.env[key]]));
  for (const key of COMMIT_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try {
    run();
  } finally {
    for (const key of COMMIT_KEYS) {
      const old = previous.get(key);
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
}

test("running commit is null when no host set it", () => {
  withCommitEnv({}, () => {
    assert.equal(runningCommitSha(), null);
    assert.equal(runningDeploymentEnv(), null);
  });
});

test("running commit prefers the Vercel SHA and exposes VERCEL_ENV", () => {
  withCommitEnv(
    {
      VERCEL_GIT_COMMIT_SHA: " abc123 ",
      RAILWAY_GIT_COMMIT_SHA: "railway456",
      VERCEL_ENV: "production",
    },
    () => {
      assert.equal(runningCommitSha(), "abc123");
      assert.equal(runningDeploymentEnv(), "production");
    }
  );
});

test("running commit falls back to the Railway SHA", () => {
  withCommitEnv({ RAILWAY_GIT_COMMIT_SHA: " railway456 " }, () => {
    assert.equal(runningCommitSha(), "railway456");
  });
});
