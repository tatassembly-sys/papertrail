import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { initSentry, captureError, isSentryEnabled, scrubEvent, resetSentryForTests } from "@/lib/sentry";
import { log, setLogSink } from "@/lib/log";

afterEach(() => {
  resetSentryForTests();
  setLogSink();
});

describe("lib/sentry", () => {
  it("is a no-op when SENTRY_DSN is unset: nothing loaded, no capture", async () => {
    let loaded = false;
    const enabled = await initSentry({ NODE_ENV: "test" } as NodeJS.ProcessEnv, async () => {
      loaded = true;
      throw new Error("must not load");
    });
    assert.equal(enabled, false);
    assert.equal(loaded, false);
    assert.equal(isSentryEnabled(), false);
    assert.doesNotThrow(() => captureError(new Error("x")));
  });

  it("initialises with PII off and forwards log.error when the DSN is set", async () => {
    const captured: unknown[] = [];
    let opts: Record<string, unknown> = {};
    const fake = {
      init: (o: Record<string, unknown>) => {
        opts = o;
      },
      captureException: (e: unknown) => captured.push(e),
    };
    const ok = await initSentry({ SENTRY_DSN: "https://k@o0.ingest.sentry.io/1" } as unknown as NodeJS.ProcessEnv, async () => fake);
    assert.equal(ok, true);
    assert.equal(opts.sendDefaultPii, false);
    setLogSink(() => {});
    log.error("boom", new Error("x"), { route: "/api/x" });
    assert.equal(captured.length, 1);
  });

  it("scrubs user, cookies, headers, body and emails/tokens", () => {
    const e = scrubEvent({
      user: { email: "a@b.co" },
      request: { cookies: { s: "1" }, headers: { authorization: "Bearer x" }, data: "pw", url: "https://x/verify?token=abc" },
      message: "failed for carol@example.com",
      exception: { values: [{ value: "Bearer secretvalue" }] },
    });
    const s = JSON.stringify(e);
    for (const bad of ["a@b.co", "cookies", "authorization", "pw", "token=abc", "carol@example.com", "secretvalue"]) {
      assert.ok(!s.includes(bad), bad);
    }
  });
});
