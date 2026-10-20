import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  consumeEmailLink,
  emailLinkExpiry,
  UNSUBSCRIBE_LINK_TTL_MS,
  VERIFY_LINK_TTL_MS,
} from "../lib/email-link";
import { hashToken } from "../lib/token-hash";
import { getSiteUrl } from "../lib/site-url";

const MAIL_SOURCES = [
  "lib/mail.ts",
  "lib/newsletter.ts",
  "app/api/auth/register/route.ts",
  "app/api/auth/resend-verify/route.ts",
  "app/api/auth/forgot-password/route.ts",
];

test("outgoing mail links use the configured site URL", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test/";
  try {
    assert.equal(getSiteUrl(), "https://example.test");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }

  for (const file of MAIL_SOURCES) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /getSiteUrl\(/);
    assert.equal(src.includes("up.railway.app"), false, file);
  }
});

const NOW = new Date("2026-06-01T12:00:00.000Z");

function freshLink(raw: string, ttlMs: number) {
  return { tokenHash: hashToken(raw), expiresAt: emailLinkExpiry(NOW, ttlMs) };
}

test("verify and unsubscribe links expire on a fixed clock", () => {
  const verify = freshLink("verify-token", VERIFY_LINK_TTL_MS);
  const unsub = freshLink("unsub-token", UNSUBSCRIBE_LINK_TTL_MS);
  assert.equal(consumeEmailLink(verify, "verify-token", NOW).ok, true);
  const verifyExpired = consumeEmailLink(
    verify,
    "verify-token",
    new Date(NOW.getTime() + VERIFY_LINK_TTL_MS)
  );
  assert.equal(verifyExpired.ok, false);
  if (!verifyExpired.ok) assert.equal(verifyExpired.reason, "expired");
  assert.equal(consumeEmailLink(unsub, "unsub-token", NOW).ok, true);
  const afterUnsub = new Date(NOW.getTime() + UNSUBSCRIBE_LINK_TTL_MS);
  const expired = consumeEmailLink(unsub, "unsub-token", afterUnsub);
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, "expired");
  assert.ok(UNSUBSCRIBE_LINK_TTL_MS > VERIFY_LINK_TTL_MS);
});

test("verify and unsubscribe links are single-use", () => {
  for (const [raw, ttl] of [
    ["verify-once", VERIFY_LINK_TTL_MS],
    ["unsub-once", UNSUBSCRIBE_LINK_TTL_MS],
  ] as const) {
    const link = freshLink(raw, ttl);
    const first = consumeEmailLink(link, raw, NOW);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = consumeEmailLink(first.next, raw, NOW);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "missing");
    assert.equal(consumeEmailLink(link, "other-token", NOW).ok, false);
  }
});

test("newsletter and account links store an expiry and clear the token", () => {
  const newsletter = readFileSync("lib/newsletter.ts", "utf8");
  const users = readFileSync("lib/users.ts", "utf8");
  assert.match(newsletter, /verify_token_expires/);
  assert.match(newsletter, /unsubscribe_token_expires/);
  assert.match(newsletter, /verify_token: null/);
  assert.match(newsletter, /unsubscribe_token: null/);
  assert.match(users, /verify_token_expires/);
  assert.match(users, /verify_token: null/);
});
