// Offline clients. global.fetch is stubbed and restored. No live HTTP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ArticleRow } from "../lib/prompts";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };

function restore() {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
}

function article(): ArticleRow {
  return {
    title: "Sleep & the brain",
    headline: "A plain note",
    why_it_matters: ["Rest matters"],
    plain_explanation: "Bodies recover.",
    caveats: "Small sample.",
    slug: "sleep-brain",
    source_url: "https://example.test/paper",
    status: "draft",
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let tail: Promise<void> = Promise.resolve();

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

test("pubmed parses fixtures and surfaces HTTP failures", async () => {
  await exclusive(async () => {
    try {
      process.env.PUBMED_TOOL_NAME = "paper-trail-test";
      process.env.PUBMED_CONTACT_EMAIL = "editor@example.test";
      const esearch = readFileSync("tests/fixtures/pubmed-esearch.json", "utf8");
      const efetch = readFileSync("tests/fixtures/pubmed-efetch.xml", "utf8");
      const calls: string[] = [];
      globalThis.fetch = async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("esearch.fcgi")) return new Response(esearch, { status: 200 });
        if (url.includes("efetch.fcgi")) return new Response(efetch, { status: 200 });
        return new Response("no", { status: 500 });
      };

      const pubmed = await import("../lib/pubmed");
      const ids = await pubmed.searchPubMedIds("sleep", 2);
      assert.equal(ids.length, 2);
      assert.equal(ids[0].pmid, "12345");
      assert.match(ids[0].url, /12345/);
      assert.match(calls[0], /tool=paper-trail-test/);
      assert.match(calls[0], /email=editor%40example\.test|email=editor@example\.test/);

      const articles = await pubmed.fetchPubMedArticles(["12345", "999"]);
      assert.equal(articles.length, 1);
      assert.equal(articles[0].pmid, "12345");
      assert.match(articles[0].title, /Sleep/);
      assert.match(articles[0].title, /brains/);
      assert.equal(articles[0].abstract, "Clears waste at night.");
      assert.deepEqual(articles[0].authors, ["Ann Lee", "Example Group", "B Ng"]);

      const extracted = await pubmed.extractPubMedText("12345");
      assert.equal(extracted.title, articles[0].title);
      assert.equal(extracted.text, "Clears waste at night.");
      assert.match(extracted.sourceUrl, /12345/);

      assert.deepEqual(await pubmed.fetchPubMedArticles([]), []);

      globalThis.fetch = async () => new Response("busy", { status: 429 });
      await assert.rejects(() => pubmed.searchPubMedIds("sleep"), /429/);
      globalThis.fetch = async () => new Response("down", { status: 500 });
      await assert.rejects(() => pubmed.fetchPubMedArticles(["1"]), /PubMed fetch failed: 500/);

      globalThis.fetch = async () => new Response("not-json", { status: 200 });
      await assert.rejects(() => pubmed.searchPubMedIds("sleep"), /JSON|json|Unexpected/);

      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      await assert.rejects(() => pubmed.searchPubMedIds("sleep"), /aborted/);

      globalThis.fetch = async () =>
        new Response("<PubmedArticle><PMID>1</PMID><ArticleTitle>Only title</ArticleTitle></PubmedArticle>", {
          status: 200,
        });
      await assert.rejects(() => pubmed.extractPubMedText("1"), /No PubMed article/);

      globalThis.fetch = async () => jsonResponse(200, { esearchresult: {} });
      assert.deepEqual(await pubmed.searchPubMedIds("none"), []);
    } finally {
      restore();
    }
  });
});

test("facebook, instagram and reddit fail closed without calling the network", async () => {
  await exclusive(async () => {
    try {
      process.env.NEXT_PUBLIC_SITE_URL = "https://paper.example";
      delete process.env.FACEBOOK_PAGE_ID;
      delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      delete process.env.INSTAGRAM_ACCESS_TOKEN;
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;
      delete process.env.REDDIT_USERNAME;
      delete process.env.REDDIT_PASSWORD;
      delete process.env.REDDIT_SUBREDDIT;

      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return new Response("no");
      };
      const facebook = await import("../lib/facebook");
      const instagram = await import("../lib/instagram");
      const reddit = await import("../lib/reddit");
      const row = article();

      assert.equal((await facebook.postToFacebook(row)).success, false);
      assert.equal((await instagram.postToInstagram(row)).success, false);
      assert.equal((await reddit.postToReddit(row)).success, false);
      assert.equal(calls, 0);

      process.env.FACEBOOK_PAGE_ID = "page-1";
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "test-key-not-real";
      globalThis.fetch = async () => jsonResponse(429, { error: { message: "slow down" } });
      const limited = await facebook.postToFacebook(row);
      assert.equal(limited.success, false);
      assert.match(limited.error || "", /slow down/);

      globalThis.fetch = async () => new Response("not-json", { status: 500 });
      const malformed = await facebook.postToFacebook(row);
      assert.equal(malformed.success, false);

      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      const aborted = await facebook.postToFacebook(row);
      assert.equal(aborted.success, false);
      assert.match(aborted.error || "", /aborted/);

      globalThis.fetch = async () => jsonResponse(200, { id: "111_222" });
      const posted = await facebook.postToFacebook(row);
      assert.equal(posted.success, true);
      assert.match(posted.postUrl || "", /111_222/);

      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-1";
      process.env.INSTAGRAM_ACCESS_TOKEN = "test-key-not-real";
      const seen: string[] = [];
      globalThis.fetch = async (input) => {
        const url = String(input);
        seen.push(url);
        if (url.includes("/media_publish")) return jsonResponse(500, { error: { message: "publish down" } });
        if (url.includes("status_code")) return jsonResponse(200, { status_code: "FINISHED" });
        if (url.includes("/media")) return jsonResponse(200, { id: "container-1" });
        return jsonResponse(500, {});
      };
      const igFail = await instagram.postToInstagram(row);
      assert.equal(igFail.success, false);
      assert.match(igFail.error || "", /publish down/);
      assert.equal(seen.length, 3);

      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.includes("status_code")) return jsonResponse(200, { status_code: "ERROR" });
        return jsonResponse(200, { id: "container-2" });
      };
      const igError = await instagram.postToInstagram(row);
      assert.equal(igError.success, false);
      assert.match(igError.error || "", /failed to process/);

      globalThis.fetch = async () => jsonResponse(429, { error: { message: "ig limited" } });
      assert.equal((await instagram.postToInstagram(row)).success, false);

      globalThis.fetch = async () => new Response("not-json", { status: 200 });
      assert.equal((await instagram.postToInstagram(row)).success, false);

      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      assert.match((await instagram.postToInstagram(row)).error || "", /aborted/);

      seen.length = 0;
      globalThis.fetch = async (input) => {
        const url = String(input);
        seen.push(url);
        if (url.includes("status_code")) return jsonResponse(200, { status_code: "FINISHED" });
        if (url.includes("/media_publish")) return jsonResponse(200, { id: "published-1" });
        return jsonResponse(200, { id: "container-3" });
      };
      const igOk = await instagram.postToInstagram(row);
      assert.equal(igOk.success, true);
      assert.equal(seen.length, 3);

      process.env.REDDIT_CLIENT_ID = "client";
      process.env.REDDIT_CLIENT_SECRET = "test-key-not-real";
      process.env.REDDIT_USERNAME = "paperbot";
      process.env.REDDIT_PASSWORD = "test-key-not-real";
      process.env.REDDIT_SUBREDDIT = "example";
      const token = readFileSync("tests/fixtures/reddit-token.json", "utf8");
      const submit = JSON.parse(readFileSync("tests/fixtures/reddit-submit.json", "utf8")) as {
        json: { data: { url: string } };
      };

      globalThis.fetch = async () => jsonResponse(500, { error: "invalid_grant" });
      const authFail = await reddit.postToReddit(row);
      assert.equal(authFail.success, false);
      assert.match(authFail.error || "", /invalid_grant/);

      globalThis.fetch = async () => new Response("not-json", { status: 200 });
      assert.equal((await reddit.postToReddit(row)).success, false);

      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      assert.match((await reddit.postToReddit(row)).error || "", /aborted/);

      let redditStep = 0;
      globalThis.fetch = async () => {
        redditStep += 1;
        if (redditStep === 1) return new Response(token, { status: 200 });
        return jsonResponse(200, { json: { errors: [["BAD", "subreddit missing"]] } });
      };
      const submitFail = await reddit.postToReddit(row);
      assert.equal(submitFail.success, false);
      assert.match(submitFail.error || "", /subreddit missing/);

      redditStep = 0;
      globalThis.fetch = async () => {
        redditStep += 1;
        if (redditStep === 1) return new Response(token, { status: 200 });
        return new Response(JSON.stringify(submit), { status: 200 });
      };
      const redditOk = await reddit.postToReddit(row);
      assert.equal(redditOk.success, true);
      assert.equal(redditOk.postUrl, submit.json.data.url);
    } finally {
      restore();
    }
  });
});

test("xAI and OpenRouter health stay offline", async () => {
  await exclusive(async () => {
    try {
      delete process.env.XAI_API_KEY;
      delete process.env.XAI_MODEL;
      delete process.env.OPENROUTER_API_KEY;
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return new Response("no");
      };
      const xai = await import("../lib/xai");
      const health = await import("../lib/openrouter-health");
      assert.equal(xai.isXaiConfigured(), false);
      await assert.rejects(
        () => xai.xaiChat({ messages: [{ role: "user", content: "hi" }] }),
        /XAI_API_KEY is not set/
      );
      const missing = await health.probeOpenRouterKey();
      assert.equal(missing.configured, false);
      assert.equal(missing.ok, false);
      assert.match(missing.message, /not set/);
      assert.equal(calls, 0);
      assert.equal(health.isOpenRouterConfigError("OPENROUTER_API_KEY is not set."), true);
      assert.equal(health.isOpenRouterConfigError("OpenRouter rejected the API key"), true);
      assert.equal(health.isOpenRouterConfigError("temporary blip"), false);

      process.env.XAI_API_KEY = "test-key-not-real";
      process.env.XAI_MODEL = "grok-test";
      assert.equal(xai.isXaiConfigured(), true);
      globalThis.fetch = async () => new Response("down", { status: 500 });
      await assert.rejects(() => xai.xaiChat({ messages: [{ role: "user", content: "hi" }] }), /500/);
      globalThis.fetch = async () => jsonResponse(200, { choices: [] });
      await assert.rejects(() => xai.xaiChat({ messages: [{ role: "user", content: "hi" }] }), /no content/);
      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      await assert.rejects(() => xai.xaiChat({ messages: [{ role: "user", content: "hi" }] }), /aborted/);
      globalThis.fetch = async () => jsonResponse(200, { choices: [{ message: { content: "  hello  " } }] });
      assert.equal(await xai.xaiChat({ messages: [{ role: "user", content: "hi" }] }), "hello");

      process.env.OPENROUTER_API_KEY = "test-key-not-real";
      globalThis.fetch = async () => new Response("no", { status: 401 });
      const rejected = await health.probeOpenRouterKey();
      assert.equal(rejected.ok, false);
      assert.match(rejected.message, /rejected the API key/);

      globalThis.fetch = async () => new Response("boom", { status: 500 });
      const failed = await health.probeOpenRouterKey();
      assert.equal(failed.ok, false);
      assert.match(failed.message, /500/);

      globalThis.fetch = async () => new Response("not-json", { status: 200 });
      const accepted = await health.probeOpenRouterKey();
      assert.equal(accepted.ok, true);
      assert.match(accepted.message, /accepted/);

      globalThis.fetch = async () => {
        throw new Error("The operation was aborted");
      };
      const offline = await health.probeOpenRouterKey();
      assert.equal(offline.ok, false);
      assert.match(offline.message, /unreachable/);

      globalThis.fetch = async () => jsonResponse(200, { data: { label: "ok" } });
      const ready = await health.probeOpenRouterKey();
      assert.equal(ready.ok, true);
      assert.equal(ready.configured, true);
      assert.ok(ready.freeCandidates.length > 0);
    } finally {
      restore();
    }
  });
});
