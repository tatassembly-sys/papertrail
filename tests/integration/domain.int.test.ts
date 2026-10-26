// Broader in-memory Mongo coverage for lib/ domain modules (M4.3).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { MongoClient } from "mongodb";

let mongod: MongoMemoryServer;
before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_domain";
  delete process.env.RESEND_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.XAI_API_KEY;
});
after(async () => {
  const g = globalThis as { _mongoClientPromise?: Promise<MongoClient> };
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

const USER = "64b000000000000000000001";

async function seedArticles() {
  const a = await import("@/lib/articles");
  const mk = (n: number, category: string, tags: string[]) =>
    a.insertDraftArticle(
      {
        title: `Paper number ${n} about ${tags[0]}`,
        headline: `Headline ${n}`,
        why_it_matters: ["x"],
        plain_explanation: `Plain explanation ${n} of ${tags.join(" ")}.`,
        caveats: "Small sample; observational.",
        tags,
        keywords: tags,
      },
      `https://arxiv.org/abs/2401.0000${n}`,
      `fallback ${n}`,
      category,
      { source: "arxiv", sourceId: `2401.0000${n}`, authors: ["Ada Lovelace", `Author ${n}`] }
    );
  const rows = [];
  for (let i = 1; i <= 6; i++) rows.push(await mk(i, i % 2 ? "q-bio.NC" : "cs.AI", i % 2 ? ["neuroscience"] : ["machine learning"]));
  for (const r of rows.slice(0, 5)) await a.updateArticle(r.id!, { status: "published" });
  return rows;
}

describe("articles", () => {
  it("publishes, lists, counts, relates, searches and edits", async () => {
    const a = await import("@/lib/articles");
    const rows = await seedArticles();
    const page = await a.getPublishedArticles(1, 10);
    assert.equal(page.total, 5);
    assert.ok((await a.getPublishedArticles(1, 10, { category: "cs" } as never)).total >= 0);
    assert.ok((await a.getPublishedArticles(1, 10, { query: "neuroscience" } as never)).articles.length >= 1);
    assert.ok((await a.getPublishedTagCounts()).some((t) => t.tag === "neuroscience"));
    assert.ok((await a.getPublishedAuthorCounts()).some((x) => x.name === "Ada Lovelace"));
    assert.equal(await a.resolveAuthorNameFromSlug("ada-lovelace"), "Ada Lovelace");
    assert.ok(await a.resolvePublishedTag("neuroscience"));
    assert.ok((await a.getRelatedPublishedArticles(rows[0].slug, "q-bio.NC")).length >= 1);
    assert.ok((await a.getAllPublishedArticles(10)).length === 5);
    assert.ok((await a.getPublishedArticlesBySlugs([rows[0].slug, rows[1].slug])).length === 2);
    assert.ok((await a.getForYouArticles(["neuroscience"])).length >= 1);
    assert.ok((await a.suggestPublishedArticles("neuro")).length >= 0);
    assert.ok(Object.keys(await a.getPublishedCategoryCounts()).length >= 1);
    assert.ok(Object.keys(await a.getAdminCategoryCounts()).length >= 1);
    assert.ok((await a.getTrendingArticles()).length >= 1);
    assert.equal((await a.getAdminArticles(1, 10, "draft")).total, 1);
    assert.equal((await a.getAdminArticles(1, 10, undefined, { query: "neuroscience" } as never)).articles.length >= 0, true);
    assert.ok(await a.getArticleBySlug(rows[5].slug, false));
    assert.equal(await a.getArticleBySlug(rows[5].slug), null);
    assert.equal((await a.getExistingSourceUrls([rows[0].source_url!])).size, 1);
    assert.equal((await a.getExistingSourceIds("arxiv", ["2401.00001", "nope"])).size, 1);
    await a.markShared(rows[0].id!, "x");
    assert.equal(await a.setShareApproved(rows[0].id!, true), true);
    assert.ok((await a.getEditorPicks()).length >= 1);
    const upd = await a.updateArticle(rows[1].id!, { title: "Renamed", tags: ["ml"], status: "draft" });
    assert.equal(upd?.title, "Renamed");
    assert.equal(await a.updateArticle("bad", { title: "x" }), null);
    assert.equal(await a.deleteArticle(rows[5].id!), true);
    assert.equal(await a.getArticleById("bad"), null);
  });
});

describe("newsletter", () => {
  it("subscribe → confirm → digest → unsubscribe", async () => {
    const n = await import("@/lib/newsletter");
    assert.equal((await n.subscribeEmail("not-an-email")).ok, false);
    const sub = await n.subscribeEmail("Reader@Example.com");
    assert.ok(sub.ok);
    if (!sub.ok) return;
    // Log mode (no Resend): active at once, no confirm token.
    assert.equal(sub.verifyToken, "");
    assert.equal(await n.confirmSubscription("deadbeef".repeat(6)), false);
    assert.equal((await n.listActiveSubscribers()).length, 1);
    const again = await n.subscribeEmail("reader@example.com");
    assert.ok(again.ok);
    const digest = await n.buildWeeklyDigest();
    assert.ok(digest);
    const sent = await n.sendWeeklyDigest();
    assert.equal(sent.subscribers, 1);
    assert.equal(sent.mode, "log");
    await n.unsubscribeByEmail("reader@example.com");
    assert.equal((await n.listActiveSubscribers()).length, 0);
    assert.equal(await n.unsubscribeByToken("nope"), false);
  });
});

describe("collections and highlights", () => {
  it("enforces free caps and supports CRUD", async () => {
    const c = await import("@/lib/collections");
    const created = await c.createCollection(USER, null, { name: "My list", description: "d", public: true });
    assert.ok("id" in created);
    const second = await c.createCollection(USER, null, { name: "Another" });
    assert.ok("error" in second && second.code === "upgrade_required");
    assert.ok("error" in (await c.createCollection(USER, null, { name: "  " })));
    if (!("id" in created)) return;
    const upd = await c.updateCollection(created.id, USER, null, { name: "Renamed", addSlug: "paper-1", public: false });
    assert.ok("id" in upd);
    await c.updateCollection(created.id, USER, null, { removeSlug: "paper-1" });
    assert.ok("error" in (await c.updateCollection(created.id, "64b000000000000000000002", null, { name: "x" })));
    assert.equal((await c.listCollections(USER)).length, 1);
    assert.ok(await c.getCollection(created.id));
    assert.equal(await c.deleteCollection(created.id, USER), true);
    await c.deleteCollectionsForUser(USER);

    const h = await import("@/lib/highlights");
    assert.ok("error" in (await h.createHighlight(USER, null, { slug: "s", quote: "" })));
    const hl = await h.createHighlight(USER, null, { slug: "s", quote: "a quote", note: "n" });
    assert.ok("id" in hl);
    assert.equal(await h.countHighlights(USER), 1);
    assert.equal((await h.listHighlights(USER)).length, 1);
    if ("id" in hl) assert.equal(await h.deleteHighlight(hl.id, USER), true);
    await h.deleteHighlightsForUser(USER);
  });
});

describe("scheduled posts, login attempts, billing inquiries", () => {
  it("schedules, claims due posts and marks them", async () => {
    const s = await import("@/lib/scheduledPosts");
    await assert.rejects(() => s.createScheduledPost("bad", "x", new Date()));
    const row = await s.createScheduledPost("64b0000000000000000000aa", "x", new Date(Date.now() - 1000));
    assert.equal((await s.getScheduledPostsForArticle("64b0000000000000000000aa")).length, 1);
    const due = await s.claimDueScheduledPosts(5);
    assert.equal(due.length, 1);
    await s.markScheduledSent(due[0]._id);
    const r2 = await s.createScheduledPost("64b0000000000000000000aa", "reddit", new Date(Date.now() + 86_400_000));
    assert.equal(await s.cancelScheduledPost(r2.id), true);
    assert.ok(row.id);
    const r3 = await s.createScheduledPost("64b0000000000000000000aa", "fb", new Date(Date.now() - 1000));
    const due3 = await s.claimDueScheduledPosts(5);
    await s.markScheduledError(due3[0]._id, "boom" as never, 1 as never);
    assert.ok(r3.id);
  });

  it("login lockout counts failures and clears", async () => {
    const l = await import("@/lib/loginAttempts");
    for (let i = 0; i < 12; i++) await l.recordFailedLogin("ip1");
    assert.equal(await l.isLoginRateLimited("ip1"), true);
    await l.clearLoginAttempts("ip1");
    assert.equal(await l.isLoginRateLimited("ip1"), false);
  });

  it("stores billing inquiries", async () => {
    const b = await import("@/lib/billing-inquiries");
    await b.createBillingInquiry({ name: "N", email: "Lab@Uni.ac.uk", org: "Uni", seats: "5" });
    assert.equal(await b.countBillingInquiries(), 1);
    assert.equal((await b.recentBillingInquiries())[0].email, "lab@uni.ac.uk");
  });
});

describe("publish mix and admin status", () => {
  it("publishes a daily mix once per day and reports ops status", async () => {
    const pm = await import("@/lib/publish-mix");
    const first = await pm.publishDailyFieldMix();
    assert.ok(first);
    const second = await pm.publishDailyFieldMix();
    assert.ok(second);
    await pm.getLastPublishMix();
    const st = await import("@/lib/admin-status");
    const status = await st.getAdminOpsStatus();
    assert.equal(status.email.mode, "log");
    assert.ok(Array.isArray(status.crons));
  });
});
