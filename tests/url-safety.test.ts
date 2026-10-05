import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRelativePath } from "../lib/safe-redirect";
import { sanitizeHttpUrl } from "../lib/http-url";

test("safeRelativePath blocks open redirects", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a?x=//b", "", null]) {
    assert.equal(safeRelativePath(bad as string | null, "/home"), "/home", String(bad));
  }
  assert.equal(safeRelativePath("/library", "/home"), "/library");
});

test("sanitizeHttpUrl only allows plain http(s)", () => {
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeHttpUrl("data:text/html,hi"), null);
  assert.equal(sanitizeHttpUrl("https://user:pw@example.com"), null);
  assert.equal(sanitizeHttpUrl("https://arxiv.org/abs/1234"), "https://arxiv.org/abs/1234");
  assert.equal(sanitizeHttpUrl("https://x.com/" + "a".repeat(600)), null);
});
