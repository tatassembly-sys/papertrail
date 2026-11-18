import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { assertSameOrigin } from "../lib/origin";

function call(method: string, headers: Record<string, string> = {}) {
  return assertSameOrigin(
    new NextRequest("https://paper.test/api/example", {
      method,
      headers: { host: "paper.test", ...headers },
    })
  );
}

test("same-origin mutations and bearer calls pass", async () => {
  assert.equal(call("GET"), null);
  assert.equal(call("HEAD"), null);
  assert.equal(call("POST"), null);
  assert.equal(call("POST", { origin: "https://paper.test" }), null);
  assert.equal(
    call("DELETE", { origin: "https://evil.test", authorization: "Bearer cron-secret" }),
    null
  );
});

test("a foreign or opaque Origin is forbidden", async () => {
  for (const origin of ["https://evil.test", "null", "not a url", "https://paper.test:444"]) {
    const res = call("POST", { origin });
    assert.ok(res, origin);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Forbidden");
    assert.equal(JSON.stringify(body).toLowerCase().includes("stack"), false);
  }
  const put = call("PUT", { origin: "https://evil.test" });
  assert.equal(put?.status, 403);
});
