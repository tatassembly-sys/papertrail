import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("proposed CI uses Node 24 actions and still tests on Node 22", () => {
  const src = readFileSync("docs/ci/proposed-ci.yml", "utf8");
  assert.match(src, /actions\/checkout@v7/);
  assert.match(src, /actions\/setup-node@v7/);
  assert.equal(src.includes("actions/checkout@v4"), false);
  assert.equal(src.includes("actions/setup-node@v4"), false);
  assert.match(src, /node:\s*\[22\]/);
  assert.match(src, /must not edit \.github\/workflows/);
});
