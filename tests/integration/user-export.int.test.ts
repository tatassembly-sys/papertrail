// Art. 15 export completeness against in-memory Mongo. Before 2026-11-23 the
// export silently stopped at 200 chats, 200 submissions and 50 billing inquiries.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ObjectId, type MongoClient } from "mongodb";

let mongod: MongoMemoryServer;
before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_export";
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

const USER = new ObjectId("64b0000000000000000000e1");
const OTHER = new ObjectId("64b0000000000000000000e2");
const EMAIL = "export-reader@example.com";
const now = new Date("2026-11-23T03:00:00.000Z");

const many = <T>(n: number, row: (i: number) => T) => Array.from({ length: n }, (_, i) => row(i));

async function seed() {
  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  await db.collection("users").insertMany([
    { _id: USER, email: EMAIL, name: "Reader", password_hash: "hash-secret", created_at: now },
    { _id: OTHER, email: "other@example.com", name: "Other", created_at: now },
  ] as never[]);
  const uid = USER.toString();
  await db.collection("article_chats").insertMany([
    ...many(250, (i) => ({ user_id: uid, article_slug: `paper-${i}`, messages: [{ role: "user", content: `q${i}`, at: now }], created_at: now, updated_at: now })),
    { user_id: OTHER.toString(), article_slug: "theirs", messages: [], created_at: now, updated_at: now },
  ]);
  await db.collection("submissions").insertMany([
    ...many(210, (i) => ({ user_id: uid, url: `https://arxiv.org/abs/2401.${String(i).padStart(5, "0")}`, status: "pending", submitted_at: now })),
    { user_id: OTHER.toString(), url: "https://example.org/theirs", status: "pending", submitted_at: now },
  ]);
  await db.collection("billing_inquiries").insertMany([
    ...many(60, (i) => ({ name: "Reader", email: EMAIL, org: `Org ${i}`, created_at: now })),
    { name: "Other", email: "other@example.com", org: "Theirs", created_at: now },
  ]);
  return db;
}

describe("exportUserData", () => {
  it("returns every row the reader owns and says the export is complete", async () => {
    const db = await seed();
    const { exportUserData } = await import("@/lib/user-export");
    const out = await exportUserData(USER.toString());
    assert.ok(out);
    assert.equal(out.chats.length, 250);
    assert.equal(out.submissions.length, 210);
    assert.equal(out.billing_inquiries.length, 60);
    assert.equal(out.complete, true);
    assert.deepEqual(out.truncated, []);
    const text = JSON.stringify(out);
    assert.equal(text.includes("theirs"), false);
    assert.equal(text.includes("Theirs"), false);
    assert.equal(text.includes("hash-secret"), false);

    // A runaway section is cut at the ceiling and flagged, never dropped silently.
    const { EXPORT_ROW_CEILING } = await import("@/lib/user-export");
    await db.collection("highlights").insertMany(
      many(EXPORT_ROW_CEILING + 5, (i) => ({ user_id: USER.toString(), article_slug: "p", quote: `q${i}`, created_at: now }))
    );
    const capped = await exportUserData(USER.toString());
    assert.ok(capped);
    assert.equal(capped.highlights.length, EXPORT_ROW_CEILING);
    assert.equal(capped.complete, false);
    assert.deepEqual(capped.truncated, ["highlights"]);
    assert.equal(capped.chats.length, 250);
  });

  it("returns null for an unknown or invalid user id", async () => {
    const { exportUserData } = await import("@/lib/user-export");
    assert.equal(await exportUserData("not-an-id"), null);
    assert.equal(await exportUserData(new ObjectId().toString()), null);
  });
});
