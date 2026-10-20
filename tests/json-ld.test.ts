import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonLdScript, postStructuredData } from "../lib/json-ld";

test("a published note emits ScholarlyArticle and BreadcrumbList", () => {
  const data = postStructuredData({
    siteUrl: "https://papertrail.example",
    title: "Dense papers, plain English",
    headline: "A short note",
    canonical: "https://papertrail.example/posts/dense-papers",
    datePublished: new Date("2026-10-19T12:00:00.000Z"),
    authors: ["Ada Lovelace"],
    keywords: ["physics"],
    sourceUrl: "https://arxiv.org/abs/2401.00001",
    licence: "https://creativecommons.org/licenses/by/4.0/",
    topic: { name: "Physics", path: "/topics/physics" },
  });

  assert.equal(data["@graph"][0]["@type"], "ScholarlyArticle");
  assert.equal(data["@graph"][0].url, "https://papertrail.example/posts/dense-papers");
  assert.equal(data["@graph"][0].datePublished, "2026-10-19T12:00:00.000Z");
  assert.equal(data["@graph"][0].license, "https://creativecommons.org/licenses/by/4.0/");
  assert.equal(data["@graph"][1]["@type"], "BreadcrumbList");
  assert.deepEqual(
    data["@graph"][1].itemListElement.map((item) => item.name),
    ["Home", "Physics", "Dense papers, plain English"]
  );
  assert.equal(data["@graph"][1].itemListElement[1].item, "https://papertrail.example/topics/physics");

  const html = jsonLdScript(data);
  assert.equal(html.includes("</script>"), false);
  assert.match(html, /ScholarlyArticle/);
  assert.match(html, /BreadcrumbList/);
});

test("a note without a topic still breadcrumbs home and the article", () => {
  const data = postStructuredData({
    siteUrl: "https://papertrail.example/",
    title: "Untitled <note>",
    headline: "x",
    canonical: "https://papertrail.example/posts/untitled",
    datePublished: null,
    authors: [],
    keywords: [],
    licence: "all rights reserved",
  });
  assert.equal(data["@graph"][0].license, undefined);
  assert.equal(data["@graph"][0].datePublished, undefined);
  assert.deepEqual(
    data["@graph"][1].itemListElement.map((item) => item.position),
    [1, 2]
  );
  assert.equal(jsonLdScript(data).includes("\\u003c"), true);
});
