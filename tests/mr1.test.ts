import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { postPageMetadata } from "../lib/post-metadata";
import { MISSING_POST_HTML, postProbeStatus } from "../lib/post-probe";
import { runningCommitSha } from "../lib/running-commit";

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

test("running commit is null when Railway did not set it", () => {
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA;
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  assert.equal(runningCommitSha(), null);
  if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
  else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
});

test("running commit returns the Railway SHA", () => {
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA;
  process.env.RAILWAY_GIT_COMMIT_SHA = " abc123 ";
  assert.equal(runningCommitSha(), "abc123");
  if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
  else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
});
