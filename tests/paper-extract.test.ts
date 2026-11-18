import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArxivLocator } from "../lib/paper-extract";

test("parseArxivLocator accepts public URLs and bare ids", () => {
  assert.equal(parseArxivLocator(null), null);
  assert.equal(parseArxivLocator("   "), null);
  assert.equal(parseArxivLocator("x".repeat(501)), null);
  assert.equal(parseArxivLocator("javascript:alert(1)"), null);
  assert.equal(parseArxivLocator("https://user:pass@example.test/2401.12345"), null);
  assert.equal(parseArxivLocator("see 2401.12345 in this sentence"), null);
  assert.equal(parseArxivLocator("2401.12345"), "2401.12345");
  assert.equal(parseArxivLocator("2401.12345v2"), "2401.12345v2");
  const clean = parseArxivLocator("https://example.test/abs/2401.12345");
  assert.match(clean || "", /^https:\/\/example\.test\/abs\/2401\.12345$/);
  assert.equal(parseArxivLocator("http://127.0.0.1/2401.12345"), null);
});
