import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("cookie page lists only the cookies the app sets and adds no banner", () => {
  const page = readFileSync("app/cookies/page.tsx", "utf8");
  const footer = readFileSync("components/SiteFooter.tsx", "utf8");
  const chat = readFileSync("app/api/articles/[id]/chat/route.ts", "utf8");
  const auth = readFileSync("lib/auth.ts", "utf8");
  const userAuth = readFileSync("lib/user-auth.ts", "utf8");

  assert.match(auth, /pt_session/);
  assert.match(userAuth, /pt_user/);
  assert.match(chat, /"pt_chat"/);
  for (const name of ["pt_session", "pt_user", "pt_chat"]) {
    assert.match(page, new RegExp(name));
  }
  assert.match(page, /strictly necessary/i);
  assert.equal(page.toLowerCase().includes("consent banner"), true);
  assert.match(page, /does not show a cookie consent banner/i);
  assert.match(footer, /href="\/cookies"/);
  assert.match(footer, /href="\/privacy"/);
  assert.match(footer, /href="\/terms"/);
  assert.equal(readFileSync("app/layout.tsx", "utf8").includes("analytics"), false);
});
