import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formatQueueLastError } from "../lib/queue-last-error";

async function loadSmoke(): Promise<{
  localOrigin: (value: unknown) => string | null;
  articlePathFromHtml: (html: unknown) => string | null;
  planSmoke: (
    baseUrl: unknown,
    homeHtml: unknown
  ) => {
    run: boolean;
    reason: string | null;
    checks: { name: string; path: string; url: string; accept: number[] }[];
  };
}> {
  return import(new URL("../scripts/smoke-http.mjs", import.meta.url).href);
}

test("formatQueueLastError is null without a stored message", () => {
  assert.equal(formatQueueLastError(null), null);
  assert.equal(formatQueueLastError({ status: "error", attempts: 3 }), null);
  assert.equal(formatQueueLastError({ error_message: "   " }), null);
});

test("formatQueueLastError shows the stored queue failure", () => {
  const line = formatQueueLastError({
    source: "arxiv",
    external_id: "2401.12345",
    status: "error",
    attempts: 3,
    error_message: "insufficient extractable text",
  });
  assert.equal(line, "arxiv 2401.12345 error 3 attempts: insufficient extractable text");
});

test("formatQueueLastError redacts secrets and collapses whitespace", () => {
  const line = formatQueueLastError({
    source: "pubmed",
    status: "error",
    attempts: 2,
    error_message:
      "dial mongodb+srv://user:secret@cluster.example.net/papertrail Bearer sk-or-v1-abcdefghijklmnopqrstuvwxyz failed",
  });
  assert.ok(line);
  assert.equal(line?.includes("secret@"), false);
  assert.equal(line?.includes("sk-or-"), false);
  assert.match(line as string, /\[redacted\]/);
  assert.match(line as string, /Bearer \[redacted\]/);
  assert.equal(line?.includes("  "), false);
});

test("admin status keeps lastError on the API payload and the page", () => {
  const lib = readFileSync("lib/admin-status.ts", "utf8");
  const page = readFileSync("app/admin/status/page.tsx", "utf8");
  const route = readFileSync("app/api/admin/status/route.ts", "utf8");
  assert.match(lib, /lastError: formatQueueLastError/);
  assert.match(lib, /status: "error"/);
  assert.match(page, /status\.queue\.lastError/);
  assert.match(route, /getAdminOpsStatus/);
});

test("smoke plan runs only for a local BASE_URL", async () => {
  const smoke = await loadSmoke();
  assert.equal(smoke.planSmoke(undefined, "").run, false);
  assert.equal(smoke.planSmoke("", "").reason, "unset");
  assert.equal(
    smoke.planSmoke("https://papertrail-production-71d6.up.railway.app", "").reason,
    "not-local"
  );
  assert.equal(smoke.localOrigin("http://user:pw@127.0.0.1:3000"), null);

  const plan = smoke.planSmoke("http://127.0.0.1:3000/", "");
  assert.equal(plan.run, true);
  assert.deepEqual(
    plan.checks.map((check) => check.name),
    ["home", "pricing", "login", "missing-article"]
  );
  assert.equal(plan.checks[0].url, "http://127.0.0.1:3000/");
  assert.deepEqual(plan.checks[3].accept, [404]);
});

test("smoke plan adds an article route only from a local post link", async () => {
  const smoke = await loadSmoke();
  const html = '<a href="/posts/alpha-note">Alpha</a><a href="https://evil.test/posts/nope">x</a>';
  const plan = smoke.planSmoke("http://localhost:3000", html);
  const article = plan.checks.find((check) => check.name === "article");
  assert.ok(article);
  assert.equal(article?.path, "/posts/alpha-note");
  assert.equal(article?.url, "http://localhost:3000/posts/alpha-note");
  assert.equal(smoke.articlePathFromHtml('<a href="/posts/not-a-real-article-mr3">x</a>'), null);
});

test("smoke-http exits 0 without a server when BASE_URL is unset", () => {
  const env = { ...process.env };
  delete env.BASE_URL;
  const result = spawnSync(process.execPath, ["scripts/smoke-http.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /BASE_URL is unset/);
});

test("smoke-http does not fetch when BASE_URL is not local", () => {
  const result = spawnSync(process.execPath, ["scripts/smoke-http.mjs"], {
    encoding: "utf8",
    env: { ...process.env, BASE_URL: "https://papertrail-production-71d6.up.railway.app" },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /not localhost/);
});
