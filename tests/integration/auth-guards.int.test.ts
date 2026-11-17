// Admin session cookie and login lockout. Uses the next/headers stub installed
// by public-http.int.test.ts (globalThis.__ptTestCookies).
import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import type { MongoClient } from "mongodb";
import { SESSION_COOKIE, signSessionToken } from "../../lib/auth";

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => {
        const jar = (globalThis as { __ptTestCookies?: Record<string, string> }).__ptTestCookies;
        const value = jar?.[name];
        return value === undefined ? undefined : { value };
      },
    }),
  },
});

const SECRET = "test-secret-0123456789abcdef-auth-guards";
const g = globalThis as { __ptTestCookies?: Record<string, string>; _mongoClientPromise?: Promise<MongoClient> };

let mongod: MongoMemoryServer;

before(async () => {
  process.env.AUTH_SECRET = SECRET;
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_auth_guards";
});

after(async () => {
  delete g.__ptTestCookies;
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

describe("admin session", () => {
  it("accepts an admin cookie and rejects missing, forged and user cookies", async () => {
    const { isAdminSession, requireAdmin } = await import("../../lib/auth-server");
    delete g.__ptTestCookies;
    assert.equal(await isAdminSession(), false);
    assert.equal(await requireAdmin(), false);

    g.__ptTestCookies = { [SESSION_COOKIE]: "not-a-jwt" };
    assert.equal(await isAdminSession(), false);

    const { signUserToken, USER_SESSION_COOKIE } = await import("../../lib/user-auth");
    const userToken = await signUserToken("user-1", "reader@example.com", 1);
    g.__ptTestCookies = { [SESSION_COOKIE]: userToken };
    assert.equal(await isAdminSession(), false);
    assert.equal(USER_SESSION_COOKIE, "pt_user");

    g.__ptTestCookies = { [SESSION_COOKIE]: await signSessionToken() };
    assert.equal(await isAdminSession(), true);
    assert.equal(await requireAdmin(), true);
    delete g.__ptTestCookies;
  });
});

describe("login lockout and unverified passwords", () => {
  it("locks an IP after five failures and still checks an unverified password", async () => {
    const users = await import("../../lib/users");
    const attempts = await import("../../lib/loginAttempts");
    const { POST } = await import("../../app/api/auth/user-login/route");

    const password = "Correct-horse-battery-9";
    const created = await users.registerUser("locked@example.com", password, "Locked");
    assert.ok("user" in created);
    const stored = await users.findUserByEmail("locked@example.com");
    assert.equal(stored?.email_verified, false);
    const ok = await users.verifyUserPassword("locked@example.com", password);
    assert.equal(ok?.email, "locked@example.com");

    const ip = "198.51.100.20";
    function request(body: unknown) {
      return new NextRequest("https://paper.test/api/auth/user-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://paper.test",
          host: "paper.test",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify(body),
      });
    }

    for (let i = 0; i < 5; i += 1) {
      const res = await POST(request({ email: "locked@example.com", password: "wrong-password-1" }));
      assert.equal(res.status, 401);
      const payload = (await res.json()) as { error?: string };
      assert.equal(payload.error, "Invalid email or password.");
      assert.equal(JSON.stringify(payload).includes("Mongo"), false);
    }
    const locked = await POST(request({ email: "locked@example.com", password }));
    assert.equal(locked.status, 429);
    const lockedBody = (await locked.json()) as { error?: string };
    assert.match(lockedBody.error || "", /15 minutes/);

    const { hashIp } = await import("../../lib/request-ip");
    await attempts.clearLoginAttempts(hashIp(ip));
    const again = await POST(request({ email: "locked@example.com", password }));
    assert.equal(again.status, 200);
  });
});
