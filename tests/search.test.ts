import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildArticleMongoFilter,
  buildSearchHref,
  catalogueEmptyCopy,
  cataloguePastEnd,
  catalogueSliceNote,
  feedChannelTitle,
  parseSearchParams,
  PUBLIC_INDEX_CAP,
  visibleIndex,
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

test("exact author match is one byline, search stays a substring", () => {
  const partial = buildArticleMongoFilter({}, { author: "Ann Lee" });
  const exact = buildArticleMongoFilter({}, { author: "a.*(b", authorExact: true });
  const partialAnd = partial.$and as Array<{ authors?: { $regex: string } }>;
  const exactAnd = exact.$and as Array<{ authors?: { $regex: string } }>;
  assert.equal(partialAnd[0].authors?.$regex, "Ann Lee");
  assert.equal(exactAnd[0].authors?.$regex, "^a\\.\\*\\(b$");
  const page = readFileSync("app/authors/[slug]/page.tsx", "utf8");
  assert.match(page, /authorExact:\s*true/);
  assert.match(page, /Open in search/);
  const href = buildSearchHref("/", { author: "Ann Lee", authorExact: true });
  assert.match(href, /author=Ann(?:\+|%20)Lee/);
  assert.match(href, /authorExact=1/);
  assert.equal(buildSearchHref("/", { authorExact: true }), "/");
  const parsed = parseSearchParams({ author: "Ann Lee", authorExact: "1" });
  assert.equal(parsed.author, "Ann Lee");
  assert.equal(parsed.authorExact, true);
  assert.equal(parseSearchParams({ authorExact: "1" }).authorExact, false);
  assert.equal(parseSearchParams({ author: "Ann Lee", authorExact: "yes" }).authorExact, false);
  const home = readFileSync("app/(home)/page.tsx", "utf8");
  assert.match(home, /authorExact: filters\.authorExact \? "1"/);
  const chips = readFileSync("components/ActiveFilters.tsx", "utf8");
  assert.match(chips, /author: undefined, authorExact: undefined/);
});

test("a byline or topic page names a truncated slice and the feed names the filter", () => {
  assert.equal(catalogueSliceNote(16, 20), " Showing the latest 16.");
  assert.equal(catalogueSliceNote(3, 3), "");
  assert.equal(catalogueSliceNote(0, 4), "");
  assert.equal(feedChannelTitle({}), "Paper Trail — Research, Translated");
  assert.equal(
    feedChannelTitle({ author: "Ann & Lee" }),
    "Paper Trail — Research, Translated · Ann & Lee"
  );
  assert.equal(
    feedChannelTitle({ category: "q-bio", author: "Ann Lee" }),
    "Paper Trail — Research, Translated · q-bio"
  );
  assert.equal(feedChannelTitle({ tag: "sleep", author: "Ann Lee" }), "Paper Trail — Research, Translated · sleep");
  const author = readFileSync("app/authors/[slug]/page.tsx", "utf8");
  assert.match(author, /catalogueSliceNote\(articles\.length, total\)/);
  assert.match(author, /buildSearchHref\("\/feed\.xml", \{ author: name, authorExact: true \}\)/);
  const topic = readFileSync("app/topics/[tag]/page.tsx", "utf8");
  assert.match(topic, /catalogueSliceNote\(articles\.length, total\)/);
  const feed = readFileSync("app/feed/route.ts", "utf8");
  assert.match(feed, /escapeXml\(feedChannelTitle\(filters\)\)/);
});

test("public indexes keep one cap and say when the rest is omitted", () => {
  assert.equal(PUBLIC_INDEX_CAP, 80);
  const exact = visibleIndex(["a", "b"], 2);
  assert.deepEqual(exact.visible, ["a", "b"]);
  assert.equal(exact.truncated, false);
  const over = visibleIndex(["a", "b", "c"], 2);
  assert.deepEqual(over.visible, ["a", "b"]);
  assert.equal(over.truncated, true);
  assert.deepEqual(visibleIndex(["a"], 0).visible, []);
  const authors = readFileSync("app/authors/page.tsx", "utf8");
  const topics = readFileSync("app/topics/page.tsx", "utf8");
  for (const src of [authors, topics]) {
    assert.match(src, /getPublished\w+\(PUBLIC_INDEX_CAP \+ 1\)/);
    assert.match(src, /visibleIndex\(loaded, PUBLIC_INDEX_CAP\)/);
  }
  assert.match(authors, /Showing the \$\{PUBLIC_INDEX_CAP\} busiest bylines/);
  assert.match(topics, /Showing the \$\{PUBLIC_INDEX_CAP\} busiest topics/);
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
