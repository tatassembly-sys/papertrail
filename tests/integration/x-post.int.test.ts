// X client. TwitterApi is mocked so the disabled, missing-key, success and error paths
// never open a socket.
import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ArticleRow } from "../../lib/prompts";

const xState = { fail: false, texts: [] as string[] };

mock.module("twitter-api-v2", {
  namedExports: {
    TwitterApi: class TwitterApi {
      v2 = {
        tweet: async (text: string) => {
          xState.texts.push(text);
          if (xState.fail) throw new Error("x down");
          return { data: { id: "99" } };
        },
      };
    },
  },
});

const saved = {
  ENABLE_X_API_POSTING: process.env.ENABLE_X_API_POSTING,
  X_API_KEY: process.env.X_API_KEY,
  X_API_SECRET: process.env.X_API_SECRET,
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
  X_ACCESS_SECRET: process.env.X_ACCESS_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

function row(): ArticleRow {
  return {
    title: "Sleep",
    headline: "A note",
    why_it_matters: ["rest"],
    plain_explanation: "body",
    caveats: "limits",
    slug: "sleep",
    source_url: "https://example.test/sleep",
    status: "published",
  };
}

afterEach(() => {
  xState.fail = false;
  xState.texts.length = 0;
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("postToX", () => {
  it("does not construct a client when posting is off or keys are missing", async () => {
    delete process.env.ENABLE_X_API_POSTING;
    delete process.env.X_API_KEY;
    const { postToX } = await import("../../lib/x");
    const { isSocialPlatform, VALID_PLATFORMS } = await import("../../lib/social");
    const disabled = await postToX(row());
    assert.equal(disabled.success, false);
    assert.match(disabled.error || "", /disabled/);
    assert.equal(xState.texts.length, 0);

    process.env.ENABLE_X_API_POSTING = "true";
    const missing = await postToX(row());
    assert.equal(missing.success, false);
    assert.match(missing.error || "", /not configured/);
    assert.equal(xState.texts.length, 0);
    assert.equal(isSocialPlatform("x"), true);
    assert.equal(isSocialPlatform("nope"), false);
    assert.ok(VALID_PLATFORMS.includes("reddit"));
  });

  it("returns the status URL or a handled error", async () => {
    process.env.ENABLE_X_API_POSTING = "true";
    process.env.X_API_KEY = "test-key-not-real";
    process.env.X_API_SECRET = "test-key-not-real";
    process.env.X_ACCESS_TOKEN = "test-key-not-real";
    process.env.X_ACCESS_SECRET = "test-key-not-real";
    process.env.NEXT_PUBLIC_SITE_URL = "https://paper.example";
    const { postToX } = await import("../../lib/x");
    const ok = await postToX(row());
    assert.equal(ok.success, true);
    assert.match(ok.postUrl || "", /99/);
    assert.equal(xState.texts.length, 1);

    xState.fail = true;
    const failed = await postToX(row());
    assert.equal(failed.success, false);
    assert.match(failed.error || "", /x down/);
  });
});
