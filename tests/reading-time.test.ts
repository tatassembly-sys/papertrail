import { test } from "node:test";
import assert from "node:assert/strict";
import { articleWordCount, readingMinutes, readingTimeLabel, wordCount } from "../lib/reading-time";
import type { ArticleRow } from "../lib/prompts";

function article(words: number): Pick<
  ArticleRow,
  "title" | "headline" | "why_it_matters" | "plain_explanation" | "caveats"
> {
  return {
    title: "",
    headline: "",
    why_it_matters: [],
    plain_explanation: Array.from({ length: words }, () => "word").join(" "),
    caveats: "",
  };
}

test("word counts ignore extra whitespace", () => {
  assert.equal(wordCount("  one   two\nthree "), 3);
  assert.equal(wordCount("   "), 0);
  assert.equal(wordCount("café naïve"), 2);
});

test("reading time rounds to at least one minute", () => {
  assert.equal(articleWordCount(article(0)), 0);
  assert.equal(readingMinutes(article(0)), 1);
  assert.equal(readingMinutes(article(220)), 1);
  assert.equal(readingMinutes(article(330)), 2);
  assert.equal(readingTimeLabel(1), "1 min read");
  assert.equal(readingTimeLabel(2), "2 min read");
});

test("reading time includes the title, headline, points and caveats", () => {
  const count = articleWordCount({
    title: "Alpha beta",
    headline: "Gamma",
    why_it_matters: ["delta epsilon"],
    plain_explanation: "zeta",
    caveats: "eta",
  });
  assert.equal(count, 7);
});
