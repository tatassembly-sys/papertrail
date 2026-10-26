import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBulkBody, BULK_MAX } from "../lib/bulk-review";

test("parseBulkBody validates action and ids", () => {
  assert.equal(typeof parseBulkBody(null), "string");
  assert.equal(typeof parseBulkBody({ action: "nuke", ids: ["a"] }), "string");
  assert.equal(typeof parseBulkBody({ action: "publish", ids: [] }), "string");
  assert.equal(typeof parseBulkBody({ action: "publish", ids: [1] }), "string");
  assert.equal(typeof parseBulkBody({ action: "reject", ids: Array(BULK_MAX + 1).fill("x") }), "string");
  assert.deepEqual(parseBulkBody({ action: "reject", ids: ["a", "a", "b"] }), { action: "reject", ids: ["a", "b"] });
});

test("bulk and retry admin routes check the admin session before reading the body", () => {
  for (const f of ["app/api/admin/articles/bulk/route.ts", "app/api/admin/queue/retry/route.ts"]) {
    const src = readFileSync(f, "utf8");
    const guard = src.indexOf("await requireAdmin()");
    assert.ok(guard > 0, f);
    assert.ok(guard < src.indexOf("readJsonBody(req"), f);
    assert.match(src, /status: 401/);
  }
});
