import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ObjectId } from "mongodb";
import { buildUserExport } from "../lib/user-export";
import type { UserDoc } from "../lib/users";

function keysDeep(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) keysDeep(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    found.add(key);
    keysDeep(child, found);
  }
  return found;
}

test("export JSON omits secrets and other people's rows", () => {
  const userId = new ObjectId();
  const otherId = new ObjectId();
  const user = {
    _id: userId,
    email: "reader@example.com",
    password_hash: "hashed-secret",
    name: "Ada",
    email_verified: true,
    verify_token: "verify-secret",
    reset_token: "reset-secret",
    saved_slugs: ["one"],
    bookmarks: [],
    followed_topics: ["sleep"],
    reading_history: [{ slug: "one", at: new Date("2026-01-02T00:00:00.000Z") }],
    created_at: new Date("2026-01-01T00:00:00.000Z"),
  } as UserDoc;

  const exported = buildUserExport({
    exportedAt: new Date("2026-10-19T00:00:00.000Z"),
    user,
    collections: [
      {
        _id: new ObjectId(),
        user_id: userId.toString(),
        name: "Mine",
        slug: "mine",
        description: "",
        slugs: ["one"],
        public: false,
        created_at: new Date("2026-01-03T00:00:00.000Z"),
        updated_at: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        _id: new ObjectId(),
        user_id: otherId.toString(),
        name: "Theirs",
        slug: "theirs",
        description: "nope",
        slugs: [],
        public: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    highlights: [],
    chats: [],
    submissions: [],
    newsletter: {
      email: "reader@example.com",
      status: "active",
      created_at: new Date("2026-02-01T00:00:00.000Z"),
      consent_at: new Date("2026-02-02T00:00:00.000Z"),
      consent_source: "double-opt-in",
    },
    billingInquiries: [],
  });

  const keys = keysDeep(exported);
  for (const secret of ["password_hash", "verify_token", "reset_token", "unsubscribe_token"]) {
    assert.equal(keys.has(secret), false, secret);
  }
  assert.equal(exported.account.email, "reader@example.com");
  assert.equal(exported.collections.length, 1);
  assert.equal(exported.collections[0].name, "Mine");
  assert.equal(exported.newsletter?.consent_source, "double-opt-in");
  assert.equal(JSON.stringify(exported).includes("hashed-secret"), false);
  assert.equal(JSON.stringify(exported).includes("Theirs"), false);
});

test("export and deletion queries stay filtered to the signed-in user", () => {
  const exportSrc = readFileSync("lib/user-export.ts", "utf8");
  const route = readFileSync("app/api/me/export/route.ts", "utf8");
  const account = readFileSync("app/account/page.tsx", "utf8");
  assert.match(route, /tooManyPublicWrites/);
  assert.match(route, /getCurrentUserSession/);
  assert.match(route, /exportUserData\(session\.userId\)/);
  assert.match(exportSrc, /find\(\{ user_id: userId \}\)/);
  assert.match(exportSrc, /findOne\(\s*\{ email: user\.email \}/);
  assert.match(exportSrc, /find\(\{ email: user\.email \}\)/);
  assert.equal(exportSrc.includes(".drop("), false);
  assert.equal(/deleteMany\(\s*\{\s*\}\s*\)/.test(exportSrc), false);

  const scoped = [
    ["lib/users.ts", /deleteOne\(\{ _id: new ObjectId\(userId\) \}\)/],
    ["lib/collections.ts", /deleteMany\(\{ user_id: userId \}\)/],
    ["lib/highlights.ts", /deleteMany\(\{ user_id: userId \}\)/],
    ["lib/article-chat.ts", /deleteMany\(\{ user_id: userId \}\)/],
  ] as const;
  for (const [file, pattern] of scoped) {
    const src = readFileSync(file, "utf8");
    assert.match(src, pattern, file);
    assert.equal(src.includes(".drop("), false, file);
    assert.equal(/deleteMany\(\s*\{\s*\}\s*\)/.test(src), false, file);
  }

  const deletion = readFileSync("app/api/me/route.ts", "utf8");
  assert.match(deletion, /deleteUserAccount\(session\.userId\)/);
  assert.match(deletion, /deleteCollectionsForUser\(session\.userId\)/);
  assert.match(deletion, /deleteHighlightsForUser\(session\.userId\)/);
  assert.match(deletion, /deleteThreadsForUser\(session\.userId\)/);
  assert.match(account, /href="\/api\/me\/export"/);
  assert.match(account, /method: "DELETE"/);
});
