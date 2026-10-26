import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { log, redact, redactString, setLogSink, formatLog, requestIdFrom } from "@/lib/log";

afterEach(() => setLogSink());

describe("lib/log", () => {
  it("emits one JSON line with level, msg, route, requestId", () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    log.error("checkout error", new Error("boom"), { route: "/api/billing/checkout", requestId: "r-1" });
    assert.equal(lines.length, 1);
    const e = JSON.parse(lines[0]);
    assert.equal(e.level, "error");
    assert.equal(e.msg, "checkout error");
    assert.equal(e.route, "/api/billing/checkout");
    assert.equal(e.requestId, "r-1");
    assert.equal(e.err.message, "boom");
    assert.ok(!("stack" in e.err));
  });

  it("redacts emails, bearer tokens, JWTs, hex tokens and Stripe keys", () => {
    const out = redactString(
      "user alice@example.com Bearer abc.def-123 eyJhbGciOi.eyJzdWIiOiIx.c2ln " +
        "token " + "a".repeat(48) + " key sk_live_ABCDEFGH12345 /verify?token=xyz&x=1"
    );
    assert.ok(!out.includes("alice@example.com"));
    assert.ok(!out.includes("abc.def-123"));
    assert.ok(!out.includes("eyJhbGciOi"));
    assert.ok(!out.includes("a".repeat(48)));
    assert.ok(!out.includes("sk_live_ABCDEFGH12345"));
    assert.ok(!out.includes("token=xyz"));
  });

  it("redacts secret-looking keys and error messages in context", () => {
    const r = redact({ email: "a@b.co", password: "p", nested: { authToken: "t", ok: 1 } }) as Record<string, unknown>;
    assert.equal(r.email, "[redacted]");
    assert.equal(r.password, "[redacted]");
    assert.deepEqual(r.nested, { authToken: "[redacted]", ok: 1 });
    const line = formatLog("warn", "x", new Error("send to bob@example.org failed"));
    assert.ok(!line.includes("bob@example.org"));
  });

  it("debug is silent unless LOG_LEVEL=debug, and a throwing sink never throws", () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    log.debug("hidden");
    assert.equal(lines.length, 0);
    setLogSink(() => {
      throw new Error("sink down");
    });
    assert.doesNotThrow(() => log.info("ok"));
  });

  it("requestIdFrom prefers x-request-id", () => {
    assert.equal(requestIdFrom(new Headers({ "x-request-id": "abc" })), "abc");
    assert.ok(requestIdFrom(new Headers()).length > 0);
  });
});
