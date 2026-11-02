import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildArticleMongoFilter,
  catalogueEmptyCopy,
  cataloguePastEnd,
  parseSearchParams,
} from "../lib/search";

type Range = { $gte?: Date; $lte?: Date };

function dateRange(filter: Record<string, unknown>): Range {
  const and = filter.$and as Array<{ $or?: Array<Record<string, unknown>> }>;
  const clause = and.find((c) => c.$or?.some((o) => "published_at" in o && o.published_at !== null));
  assert.ok(clause, "date clause present");
  return clause!.$or![0].published_at as Range;
}

test("date-only `to` covers the whole UTC day regardless of server TZ", () => {
  const range = dateRange(buildArticleMongoFilter({}, { from: "2026-10-01", to: "2026-10-05" }));
  assert.equal(range.$gte?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(range.$lte?.toISOString(), "2026-10-05T23:59:59.999Z");
});

test("full timestamp `to` is kept as an explicit bound", () => {
  const range = dateRange(buildArticleMongoFilter({}, { to: "2026-10-05T12:00:00Z" }));
  assert.equal(range.$lte?.toISOString(), "2026-10-05T12:00:00.000Z");
});

test("invalid dates are ignored", () => {
  const f = buildArticleMongoFilter({}, { from: "nope", to: "also-nope" });
  assert.equal(f.$and, undefined);
});

test("regex metacharacters in author are escaped", () => {
  const f = buildArticleMongoFilter({}, { author: "a.*(b" });
  const and = f.$and as Array<{ authors?: { $regex: string } }>;
  assert.equal(and[0].authors?.$regex, "a\\.\\*\\(b");
});

test("catalogue empty copy covers a blank list, a later page, and a filter", () => {
  assert.equal(catalogueEmptyCopy(false, 1, 0), "No entries filed yet. Check back soon.");
  assert.equal(catalogueEmptyCopy(false, 2, 0), "No entries filed yet. Check back soon.");
  assert.equal(catalogueEmptyCopy(false, 2, 3), "No more entries.");
  assert.equal(cataloguePastEnd(false, 2, 3), true);
  assert.equal(cataloguePastEnd(false, 2, 0), false);
  assert.equal(cataloguePastEnd(true, 9, 4), false);
  assert.equal(catalogueEmptyCopy(true, 1, 0), "No entries match that search or category.");
  assert.equal(catalogueEmptyCopy(true, 9, 4), "No entries match that search or category.");
  const page = readFileSync("app/(home)/page.tsx", "utf8");
  assert.match(page, /catalogueEmptyCopy\(isFiltered, page, total\)/);
  assert.match(page, /cataloguePastEnd\(isFiltered, page, total\)/);
  assert.match(page, /Latest entries →/);
});

test("parseSearchParams drops unknown source/sort", () => {
  const f = parseSearchParams({ source: "evil", sort: "random", q: "  hi " });
  assert.equal(f.source, "");
  assert.equal(f.sort, undefined);
  assert.equal(f.query, "hi");
});
