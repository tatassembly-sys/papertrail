import { test } from "node:test";
import assert from "node:assert/strict";
import { articleToMarkdown, markdownFilename } from "../lib/export-note";
import type { ArticleRow } from "../lib/prompts";

function article(over: Partial<ArticleRow> = {}): ArticleRow {
  return {
    title: `Tom & Jerry <draft> "quotes" café`,
    headline: "One sentence.",
    why_it_matters: ["Point & <b>", `Second "point"`],
    plain_explanation: "Plain & simple.",
    caveats: "A caveat.",
    slug: "Tom & Jerry!",
    source_url: "https://arxiv.org/abs/1?q=a&b=2",
    status: "published",
    authors: ["José Núñez", "Ann Lee"],
    ...over,
  };
}

test("markdown keeps special characters and names the authors", () => {
  const md = articleToMarkdown(article(), "https://paper.test/");
  assert.match(md, /^# Tom & Jerry <draft> "quotes" café\n/);
  assert.match(md, /Authors: José Núñez, Ann Lee/);
  assert.match(md, /Original paper: https:\/\/arxiv\.org\/abs\/1\?q=a&b=2/);
  assert.match(md, /Plain-language note: https:\/\/paper\.test\/posts\/Tom & Jerry!/);
  assert.match(md, /1\. Point & <b>/);
  assert.match(md, /## In plain language\nPlain & simple\./);
  assert.equal(md.endsWith("\n"), true);
  assert.equal(md.includes("mongodb"), false);
});

test("markdown omits empty author and source lines", () => {
  const md = articleToMarkdown(
    article({ authors: [], source_url: null, why_it_matters: [], plain_explanation: "", caveats: "" }),
    "https://paper.test"
  );
  assert.equal(md.includes("Authors:"), false);
  assert.equal(md.includes("Original paper:"), false);
  assert.match(md, /_Not listed\._/);
});

test("download filenames keep only safe characters", () => {
  assert.equal(markdownFilename(`Tom & Jerry <draft> "café"`), "Tom-Jerry-draft-caf.md");
  assert.equal(markdownFilename("@@@"), "note.md");
  assert.equal(markdownFilename("already-safe"), "already-safe.md");
});
