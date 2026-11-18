import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { verifyAdminCredentials } from "../lib/auth-credentials";

const PASSWORD = "correct-horse-staple";
const HASH = bcrypt.hashSync(PASSWORD, 4);

function withAdminEnv(extra: Record<string, string | undefined>, fn: () => void) {
  const keys = ["ADMIN_EMAIL", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("admin credentials accept only the configured login and password", () => {
  withAdminEnv({ ADMIN_EMAIL: "Admin@Paper.test", ADMIN_PASSWORD_HASH: HASH }, () => {
    assert.equal(verifyAdminCredentials("admin@paper.test", PASSWORD), true);
    assert.equal(verifyAdminCredentials("admin@paper.test", "wrong-password"), false);
    assert.equal(verifyAdminCredentials("other@paper.test", PASSWORD), false);
    assert.equal(verifyAdminCredentials("admin@paper.test", ""), false);
  });
});

test("ADMIN_USERNAME is the fallback login id", () => {
  withAdminEnv({ ADMIN_USERNAME: "editor", ADMIN_PASSWORD_HASH: HASH }, () => {
    assert.equal(verifyAdminCredentials("editor", PASSWORD), true);
    assert.equal(verifyAdminCredentials("someone-else", PASSWORD), false);
  });
});

test("missing config throws and a broken hash does not authenticate", () => {
  withAdminEnv({}, () => {
    assert.throws(() => verifyAdminCredentials("admin@paper.test", PASSWORD), /ADMIN_EMAIL/);
  });
  withAdminEnv({ ADMIN_EMAIL: "admin@paper.test", ADMIN_PASSWORD_HASH: "not-a-bcrypt-hash" }, () => {
    assert.equal(verifyAdminCredentials("admin@paper.test", PASSWORD), false);
  });
});
