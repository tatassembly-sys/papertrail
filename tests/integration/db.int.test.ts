// Integration tests against an in-memory MongoDB (mongodb-memory-server).
// Run with `npm run test:integration`. Not part of `npm test`.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { MongoClient } from "mongodb";

let mongod: MongoMemoryServer;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_int";
});

after(async () => {
  const g = globalThis as { _mongoClientPromise?: Promise<MongoClient> };
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

const PASSWORD = "Correct-horse-battery-9";

describe("users (in-memory Mongo)", () => {
  it("registers, rejects duplicates, and verifies the password", async () => {
    const users = await import("@/lib/users");
    const res = await users.registerUser("Alice@Example.com ", PASSWORD, "Alice");
    assert.ok("user" in res, JSON.stringify(res));
    const dup = await users.registerUser("alice@example.com", PASSWORD, "Alice");
    assert.ok("error" in dup);
    assert.ok(await users.verifyUserPassword("alice@example.com", PASSWORD));
    assert.equal(await users.verifyUserPassword("alice@example.com", "wrong-Password-1"), null);
    assert.equal(await users.verifyUserPassword("nobody@example.com", PASSWORD), null);
  });

  it("verify-email token is single use", async () => {
    const users = await import("@/lib/users");
    const res = await users.registerUser("bob@example.com", PASSWORD, "Bob");
    assert.ok("verifyToken" in res);
    assert.equal(await users.verifyEmailToken(res.verifyToken), true);
    assert.equal(await users.verifyEmailToken(res.verifyToken), false);
    const doc = await users.findUserByEmail("bob@example.com");
    assert.equal(doc?.email_verified, true);
  });

  it("password reset changes the password, bumps token_version, and is single use", async () => {
    const users = await import("@/lib/users");
    const before = await users.findUserByEmail("alice@example.com");
    const token = await users.createPasswordResetToken("alice@example.com");
    assert.ok(token);
    assert.equal(await users.createPasswordResetToken("nobody@example.com"), null);
    const next = "Another-strong-pass-42";
    assert.equal(await users.resetPasswordWithToken(token, next), true);
    assert.equal(await users.resetPasswordWithToken(token, next), false);
    assert.ok(await users.verifyUserPassword("alice@example.com", next));
    const afterDoc = await users.findUserByEmail("alice@example.com");
    assert.equal(afterDoc?.token_version, (before?.token_version ?? 1) + 1);
  });

  it("deletes an account", async () => {
    const users = await import("@/lib/users");
    const doc = await users.findUserByEmail("bob@example.com");
    assert.ok(doc);
    assert.equal(await users.deleteUserAccount(doc._id.toString()), true);
    assert.equal(await users.findUserByEmail("bob@example.com"), null);
    assert.equal(await users.deleteUserAccount("not-an-id"), false);
  });
});

describe("submissions (in-memory Mongo)", () => {
  it("creates, lists by priority, dedupes pending, and rate limits per IP", async () => {
    const s = await import("@/lib/submissions");
    const ip = "iphash-1";
    assert.equal(await s.isRateLimited(ip), false);
    await s.createSubmission("https://arxiv.org/abs/1", undefined, ip);
    const pri = await s.createSubmission("https://arxiv.org/abs/2", "note", ip, { priority: true });
    await s.createSubmission("https://arxiv.org/abs/3", undefined, ip);
    assert.equal(await s.isRateLimited(ip), true);
    assert.equal(await s.isRateLimited("other"), false);
    const rows = await s.getSubmissions();
    assert.equal(rows.length, 3);
    assert.equal(rows[0].id, pri.id);
    assert.equal(await s.hasPendingSubmission("https://arxiv.org/abs/1"), true);
    assert.equal(await s.updateSubmissionStatus(pri.id, "processed"), true);
    assert.equal(await s.hasPendingSubmission("https://arxiv.org/abs/2"), false);
    assert.equal((await s.getSubmissions("processed")).length, 1);
    assert.equal(await s.updateSubmissionStatus("bad", "dismissed"), false);
  });
});

describe("rate-limit (in-memory Mongo)", () => {
  it("allows up to max hits per window, then blocks; undo releases one", async () => {
    const rl = await import("@/lib/rate-limit");
    const w = 60_000;
    for (let i = 0; i < 3; i++) assert.equal(await rl.hitRateLimit("t", "k", 3, w), false);
    assert.equal(await rl.hitRateLimit("t", "k", 3, w), true);
    assert.equal(await rl.getRateCount("t", "k", w), 4);
    await rl.undoRateLimit("t", "k", w);
    assert.equal(await rl.getRateCount("t", "k", w), 3);
    assert.equal(await rl.hitRateLimit("t", "other", 3, w), false);
  });

  it("concurrent hits are counted atomically", async () => {
    const rl = await import("@/lib/rate-limit");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => rl.hitRateLimit("c", "k", 5, 60_000))
    );
    assert.equal(results.filter((blocked) => !blocked).length, 5);
    assert.equal(await rl.getRateCount("c", "k", 60_000), 10);
  });
});

describe("health cron summary (in-memory Mongo)", () => {
  it("reports cron_last_run per job and queue_depth", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const { cronHealthSummary, CRON_JOBS } = await import("@/lib/cron-run");
    const db = await getDb();
    await db.collection("cron_runs").insertMany([
      { job: "process-queue", status: 200, ok: true, at: new Date() },
      { job: "cron-fetch", status: 500, ok: false, at: new Date(Date.now() - 5 * 86_400_000) },
    ]);
    await db.collection("fetch_queue").insertMany(
      ["a", "b", "c"].map((id, i) => ({ source: "arxiv", external_id: id, status: i < 2 ? "pending" : "done" }))
    );
    const h = await cronHealthSummary();
    assert.equal(h.queue_depth, 2);
    assert.deepEqual(Object.keys(h.cron_last_run), [...CRON_JOBS]);
    assert.equal(h.cron_last_run["process-queue"].stale, false);
    assert.equal(h.cron_last_run["cron-fetch"].stale, true);
    assert.equal(h.cron_last_run["cron-fetch"].ok, false);
    assert.equal(h.cron_last_run["newsletter-digest"].at, null);
  });
});

describe("article list projections (in-memory Mongo)", () => {
  it("trending, editor picks and the probe do not load the article body", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const a = await import("@/lib/articles");
    const db = await getDb();
    await db.collection("articles").insertOne({
      title: "T", headline: "H", slug: "t-1", status: "published", share_approved: true,
      plain_explanation: "BODY".repeat(1000), published_at: new Date(), created_at: new Date(),
    });
    for (const list of [await a.getTrendingArticles(5), await a.getEditorPicks(3)]) {
      assert.equal(list.length, 1);
      assert.ok(!JSON.stringify(list).includes("BODYBODY"));
    }
    assert.equal(await a.publishedSlugExists("t-1"), true);
    assert.equal(await a.publishedSlugExists("nope"), false);
  });
});

describe("text search index (in-memory Mongo)", () => {
  it("is created by ensureIndexes and $text queries work under the default Stable API", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    const names = (await db.collection("articles").indexes()).map((i) => i.name);
    assert.ok(names.includes("articles_text_search_v2"), names.join(","));
    await db.collection("articles").insertOne({ title: "Neutrino oscillation results", slug: "nu", status: "published" });
    const hits = await db.collection("articles").find({ $text: { $search: "neutrino" } }).toArray();
    assert.ok(hits.length >= 1);
  });
});

describe("admin bulk review and queue retry (in-memory Mongo)", () => {
  it("publishes eligible drafts, rejects drafts, never touches published", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const { bulkReview } = await import("@/lib/bulk-review");
    const db = await getDb();
    const base = { headline: "h", plain_explanation: "p", created_at: new Date() };
    const ok = await db.collection("articles").insertOne({
      ...base, title: "Good draft", slug: "good-draft", status: "draft",
      source_url: "https://arxiv.org/abs/2401.00001", caveats: "Small sample; observational.",
    });
    const bad = await db.collection("articles").insertOne({ ...base, title: "No source", slug: "no-src", status: "draft", source_url: null, caveats: "" });
    const pub = await db.collection("articles").findOne({ slug: "t-1" });
    const ids = [ok.insertedId, bad.insertedId, pub!._id].map(String);
    const res = await bulkReview("publish", ids);
    assert.deepEqual(res.map((r) => r.ok), [true, false, false]);
    assert.equal((await db.collection("articles").findOne({ _id: ok.insertedId }))?.status, "published");
    const rej = await bulkReview("reject", [String(bad.insertedId), String(pub!._id)]);
    assert.deepEqual(rej.map((r) => r.ok), [true, false]);
    assert.equal(await db.collection("articles").countDocuments({ _id: bad.insertedId }), 0);
    assert.equal(await db.collection("articles").countDocuments({ _id: pub!._id }), 1);
  });

  it("retries failed queue rows with a fresh attempt budget", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const { retryFailedQueueItems } = await import("@/lib/queue");
    const db = await getDb();
    const r = await db.collection("fetch_queue").insertMany([
      { source: "arxiv", external_id: "e1", status: "error", attempts: 3, error_message: "x" },
      { source: "arxiv", external_id: "e2", status: "error", attempts: 3, error_message: "y" },
    ]);
    assert.equal(await retryFailedQueueItems([String(r.insertedIds[0])]), 1);
    const one = await db.collection("fetch_queue").findOne({ external_id: "e1" });
    assert.equal(one?.status, "pending");
    assert.equal(one?.attempts, 0);
    assert.equal(one?.error_message, undefined);
    assert.equal(await retryFailedQueueItems(["bad-id"]), 0);
    assert.equal(await retryFailedQueueItems(), 1);
  });
});

describe("draft LLM usage (in-memory Mongo)", () => {
  it("insertDraftArticle stores model + cost and list rows return it", async () => {
    const a = await import("@/lib/articles");
    const { usageFrom } = await import("@/lib/llm-cost");
    const row = await a.insertDraftArticle(
      {
        title: "Cost tracked draft", headline: "h", why_it_matters: [], plain_explanation: "p", caveats: "c",
        llm: usageFrom("openrouter", "paid/model", { cost: 0.002, prompt_tokens: 9, completion_tokens: 3 }),
      },
      "https://arxiv.org/abs/2401.99999",
      "fallback",
      null,
      { source: "arxiv", sourceId: "2401.99999" }
    );
    assert.equal(row.llm?.cost_microusd, 2000);
    const { articles } = await a.getAdminArticles(1, 50, "draft");
    const listed = articles.find((x) => x.id === row.id);
    assert.equal(listed?.llm?.model, "paid/model");
  });
});
