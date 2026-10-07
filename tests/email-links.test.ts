import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
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
