import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordPolicyError } from "../lib/passwords";

test("password policy requires 10 characters and rejects a common password", () => {
  assert.match(passwordPolicyError("short") || "", /10/);
  assert.match(passwordPolicyError("password123") || "", /common/);
  assert.equal(passwordPolicyError("sandbox-pw1"), null);
  assert.match(passwordPolicyError("x".repeat(73)) || "", /72/);
});
