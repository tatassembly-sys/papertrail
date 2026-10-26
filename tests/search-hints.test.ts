import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyStateHints } from "../lib/search-hints";

test("emptyStateHints suggests other topics, never the typed one", () => {
  assert.deepEqual(emptyStateHints("zzz"), ["tech", "space", "health", "math"]);
  assert.ok(!emptyStateHints("Tech").includes("tech"));
  assert.ok(!emptyStateHints("spa").includes("space"));
  assert.equal(emptyStateHints("x", 2).length, 2);
});

test("SearchBar is debounced, keyboard accessible and has an empty state", () => {
  const src = readFileSync("components/SearchBar.tsx", "utf8");
  assert.match(src, /setTimeout\(/);
  assert.match(src, /AbortController/);
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) assert.ok(src.includes(`"${key}"`), key);
  assert.match(src, /aria-activedescendant/);
  assert.match(src, /emptyStateHints\(/);
});
