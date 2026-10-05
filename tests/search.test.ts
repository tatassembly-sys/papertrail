import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArticleMongoFilter, parseSearchParams } from "../lib/search";

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

test("parseSearchParams drops unknown source/sort", () => {
  const f = parseSearchParams({ source: "evil", sort: "random", q: "  hi " });
  assert.equal(f.source, "");
  assert.equal(f.sort, undefined);
  assert.equal(f.query, "hi");
});
