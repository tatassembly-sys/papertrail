import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canonicalPostUrl, postPageMetadata, publishedSitemapArticles } from "../lib/post-metadata";

test("sitemap lists published posts and drops unpublished or missing ones", () => {
  const entries = publishedSitemapArticles(
    [
      { slug: "live", status: "published", published_at: "2026-01-02T00:00:00.000Z" },
      { slug: "draft", status: "draft", published_at: "2026-01-03T00:00:00.000Z" },
      { slug: "   ", status: "published" },
      { status: "published" },
      { slug: "no-status" },
      { slug: "blank-date", status: "published", published_at: "not-a-date" },
    ],
    "https://example.test/"
  );
  assert.deepEqual(
    entries.map((entry) => entry.url),
    ["https://example.test/posts/live", "https://example.test/posts/blank-date"]
  );
  assert.equal(entries[0].lastModified?.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(entries[1].lastModified, undefined);
});

test("canonical URLs are only for published posts", () => {
  assert.equal(
    canonicalPostUrl({ slug: "live", status: "published" }, "https://example.test/"),
    "https://example.test/posts/live"
  );
  assert.equal(canonicalPostUrl({ slug: "draft", status: "draft" }, "https://example.test"), null);
  assert.equal(canonicalPostUrl(null, "https://example.test"), null);
  assert.equal(canonicalPostUrl({ slug: "  ", status: "published" }, "https://example.test"), null);
  const draft = postPageMetadata(
    { slug: "draft", title: "Secret", headline: "no", status: "draft" },
    "https://example.test"
  );
  assert.equal(draft.alternates, undefined);
  assert.deepEqual(draft.robots, { index: false, follow: false });
});

test("sitemap route builds article URLs from the published filter", () => {
  const src = readFileSync("app/sitemap.ts", "utf8");
  assert.match(src, /publishedSitemapArticles/);
  assert.equal(src.includes("/posts/${article.slug}"), false);
});
