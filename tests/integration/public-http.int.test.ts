// HTTP edges that need Mongo: subscribe validation, suggest misses, unsigned /api/me.
import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import type { MongoClient } from "mongodb";
import { emptyStateHints } from "../../lib/search-hints";

// next/headers cookies() only works inside a request. The integration script
// passes --experimental-test-module-mocks so this stub is visible to the routes.
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: () => undefined,
    }),
  },
});

let mongod: MongoMemoryServer;

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_http";
  delete process.env.RESEND_API_KEY;
  const env = process.env as { NODE_ENV?: string };
  if (env.NODE_ENV === "production") env.NODE_ENV = "test";
});

after(async () => {
  const g = globalThis as { _mongoClientPromise?: Promise<MongoClient> };
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

function jsonRequest(path: string, method: string, body?: unknown, ip = "203.0.113.10") {
  return new NextRequest(`https://example.test${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "x-forwarded-for": ip,
      origin: "https://example.test",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("newsletter subscribe HTTP", () => {
  it("rejects an invalid email and treats a duplicate as success", async () => {
    const { POST } = await import("../../app/api/newsletter/subscribe/route");
    const bad = await POST(jsonRequest("/api/newsletter/subscribe", "POST", { email: "not-an-email" }, "203.0.113.11"));
    assert.equal(bad.status, 400);
    const badBody = (await bad.json()) as { error?: string };
    assert.match(badBody.error || "", /valid email/i);
    assert.equal(JSON.stringify(badBody).includes("Mongo"), false);

    const email = `reader-${Date.now()}@example.com`;
    const first = await POST(jsonRequest("/api/newsletter/subscribe", "POST", { email }, "203.0.113.12"));
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { success?: boolean; emailSent?: boolean };
    assert.equal(firstBody.success, true);
    assert.equal(firstBody.emailSent, false);

    const again = await POST(jsonRequest("/api/newsletter/subscribe", "POST", { email }, "203.0.113.13"));
    assert.equal(again.status, 200);
    const againBody = (await again.json()) as { success?: boolean; emailSent?: boolean };
    assert.equal(againBody.success, true);
    assert.equal(againBody.emailSent, true);

    const newsletter = await import("../../lib/newsletter");
    const active = (await newsletter.listActiveSubscribers()).filter((row) => row.email === email);
    assert.equal(active.length, 1);
  });
});

describe("search suggest misses", () => {
  it("returns no articles for an unknown query and hints stay off that query", async () => {
    const { getDb } = await import("../../lib/mongodb");
    const db = await getDb();
    const now = new Date();
    await db.collection("articles").insertOne({
      title: "Sleep clears waste from the brain",
      headline: "A sample note used by the suggest test.",
      slug: "sleep-clears-waste-vs4",
      status: "published",
      category: "q-bio",
      tags: ["neuroscience"],
      keywords: ["sleep"],
      authors: ["A. Researcher"],
      plain_explanation: "Sample body.",
      source: "arxiv",
      source_url: "https://arxiv.org/abs/0000.00001",
      published_at: now,
      created_at: now,
    });

    const articles = await import("../../lib/articles");
    const hit = await articles.suggestPublishedArticles("sleep");
    assert.ok(hit.some((row) => row.slug === "sleep-clears-waste-vs4"));
    const miss = await articles.suggestPublishedArticles("zzzzqqqq");
    assert.equal(miss.length, 0);

    const { GET } = await import("../../app/api/search/suggest/route");
    const res = await GET(
      new NextRequest("https://example.test/api/search/suggest?q=zzzzqqqq", {
        headers: { "x-forwarded-for": "203.0.113.20" },
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { suggestions?: unknown[] };
    assert.deepEqual(body.suggestions, []);

    const hints = emptyStateHints("zzzzqqqq");
    assert.ok(hints.includes("tech"));
    assert.equal(hints.includes("zzzzqqqq"), false);
  });
});

describe("unauthenticated /api/me", () => {
  it("GET returns a null user; export and delete are 401", async () => {
    const { GET, DELETE } = await import("../../app/api/me/route");
    const { GET: exportGet } = await import("../../app/api/me/export/route");

    const me = await GET();
    assert.equal(me.status, 200);
    const meBody = (await me.json()) as { user?: unknown };
    assert.equal(meBody.user, null);
    assert.equal(JSON.stringify(meBody).includes("password_hash"), false);

    const exported = await exportGet(jsonRequest("/api/me/export", "GET", undefined, "203.0.113.30"));
    assert.equal(exported.status, 401);
    const exportBody = (await exported.json()) as { error?: string };
    assert.equal(exportBody.error, "Unauthorized");

    const removed = await DELETE(jsonRequest("/api/me", "DELETE", undefined, "203.0.113.31"));
    assert.equal(removed.status, 401);
    const deleteBody = (await removed.json()) as { error?: string };
    assert.equal(deleteBody.error, "Unauthorized");
  });
});
