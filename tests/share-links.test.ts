import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareLinks } from "../lib/share-links";
import type { ArticleRow } from "../lib/prompts";

function article(): ArticleRow {
  return {
    title: `Tom & Jerry <draft> "quotes" café`,
    headline: `A & B <C> "hi" 🧪`,
    why_it_matters: ["one"],
    plain_explanation: "plain",
    caveats: "caveat",
    slug: "tom-jerry",
    source_url: "https://arxiv.org/abs/1",
    status: "published",
    authors: ["José Núñez"],
  };
}

test("share links encode title and headline characters", () => {
  const links = buildShareLinks(article(), "https://paper.test");
  const values = Object.values(links);
  for (const url of values) {
    assert.equal(url.includes("<"), false, url);
    assert.equal(url.includes('"'), false, url);
    assert.match(url, /^https:\/\//);
  }
  const x = new URL(links.x);
  assert.equal(x.searchParams.get("text"), `A & B <C> "hi" 🧪`);
  assert.equal(x.searchParams.get("url"), "https://paper.test/posts/tom-jerry");
  const reddit = new URL(links.reddit);
  assert.equal(reddit.searchParams.get("title"), `Tom & Jerry <draft> "quotes" café`);
});
