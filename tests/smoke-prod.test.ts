import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("smoke-prod exits 1 when the base URL is missing", () => {
  const result = spawnSync(process.execPath, ["scripts/smoke-prod.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL base/);
});

test("smoke-prod accepts the public checks and rejects a bad health body", async () => {
  const smoke = await import(new URL("../scripts/smoke-prod.mjs", import.meta.url).href);

  const ok = await smoke.runSmoke("http://127.0.0.1:3000", async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/health") {
      return { status: 200, json: async () => ({ status: "ok", db: "connected" }) };
    }
    if (path === "/posts/not-a-real-article-m0") return { status: 404, json: async () => ({}) };
    if (path === "/api/process-queue") return { status: 401, json: async () => ({ error: "Unauthorized" }) };
    return { status: 200, json: async () => ({}) };
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(
    ok.results.map((result: { name: string }) => result.name),
    ["home", "health", "missing-post", "unsigned-queue", "sitemap", "robots"]
  );

  const badHealth = await smoke.runSmoke("https://example.test", async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/health") return { status: 200, json: async () => ({ status: "error" }) };
    if (path === "/posts/not-a-real-article-m0") return { status: 404, json: async () => ({}) };
    if (path === "/api/process-queue") return { status: 401, json: async () => ({}) };
    return { status: 200, json: async () => ({}) };
  });
  assert.equal(badHealth.ok, false);
  assert.equal(
    badHealth.results.find((result: { name: string; pass: boolean }) => result.name === "health")?.pass,
    false
  );
});
