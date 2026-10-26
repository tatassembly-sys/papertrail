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
