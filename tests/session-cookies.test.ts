import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adminSessionCookieOptions } from "../lib/auth";
import { timingSafeEqualString } from "../lib/token-hash";
import { userSessionCookieOptions } from "../lib/user-auth";

function withNodeEnv(value: string, run: () => void) {
  const env = process.env as { NODE_ENV?: string };
  const previous = env.NODE_ENV;
  env.NODE_ENV = value;
  try {
    run();
  } finally {
    env.NODE_ENV = previous;
  }
}

test("session cookies are HttpOnly, Lax, and Secure in production", () => {
  withNodeEnv("development", () => {
    assert.equal(adminSessionCookieOptions().secure, false);
    assert.equal(userSessionCookieOptions().secure, false);
  });
  withNodeEnv("production", () => {
    for (const options of [adminSessionCookieOptions(), userSessionCookieOptions()]) {
      assert.equal(options.httpOnly, true);
      assert.equal(options.secure, true);
      assert.equal(options.sameSite, "lax");
      assert.equal(options.path, "/");
    }
  });
  const chat = readFileSync("app/api/articles/[id]/chat/route.ts", "utf8");
  assert.match(chat, /httpOnly: true/);
  assert.match(chat, /sameSite: "lax"/);
  assert.match(chat, /secure: process\.env\.NODE_ENV === "production"/);
});

test("CRON_SECRET compare is constant-time", () => {
  assert.equal(timingSafeEqualString("Bearer secret-value", "Bearer secret-value"), true);
  assert.equal(timingSafeEqualString("Bearer secret-value", "Bearer other-value"), false);
  assert.equal(timingSafeEqualString("short", "Bearer secret-value"), false);
  const cron = readFileSync("lib/cron-auth.ts", "utf8");
  assert.match(cron, /timingSafeEqualString\(authHeader, expected\)/);
});

test("user login uses the same lockout helper as admin login", () => {
  const userLogin = readFileSync("app/api/auth/user-login/route.ts", "utf8");
  const adminLogin = readFileSync("app/api/auth/login/route.ts", "utf8");
  for (const source of [userLogin, adminLogin]) {
    assert.match(source, /isLoginRateLimited/);
    assert.match(source, /recordFailedLogin/);
  }
});
