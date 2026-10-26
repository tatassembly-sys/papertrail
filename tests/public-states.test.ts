import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// M9.1: list pages without notFound() get a loading skeleton; every public list
// page renders an explicit empty state; a root error boundary exists.
test("public list pages have loading skeletons where safe", () => {
  for (const d of ["app/(home)", "app/today", "app/library"]) {
    assert.ok(existsSync(`${d}/loading.tsx`), d);
  }
  // A loading boundary here would wrap a child route that calls notFound() (real 404s).
  for (const d of ["app/topics", "app/authors", "app/lists", "app/posts"]) {
    assert.equal(existsSync(`${d}/loading.tsx`), false, d);
  }
});

test("public list pages render an empty state and the app has an error boundary", () => {
  for (const f of [
    "app/topics/page.tsx",
    "app/topics/[tag]/page.tsx",
    "app/authors/page.tsx",
    "app/authors/[slug]/page.tsx",
    "app/today/page.tsx",
    "app/library/page.tsx",
    "app/lists/[id]/page.tsx",
  ]) {
    assert.match(readFileSync(f, "utf8"), /\.length === 0 \?/, f);
  }
  assert.ok(existsSync("app/error.tsx"));
  assert.ok(existsSync("app/not-found.tsx"));
});
