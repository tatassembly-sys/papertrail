import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCitation } from "../lib/cite";
import type { ArticleRow } from "../lib/prompts";

function article(over: Partial<ArticleRow> = {}): ArticleRow {
  return {
    title: `Cells & signals <in vivo> "quoted".`,
    headline: "headline",
    why_it_matters: [],
    plain_explanation: "",
    caveats: "",
    slug: "cells-signals",
    source_url: "https://arxiv.org/abs/9",
    status: "published",
    authors: ["José Núñez", "Ann Lee"],
    published_at: "2024-05-01T00:00:00.000Z",
    ...over,
  };
}

test("citations keep punctuation and non-ASCII names as plain text", () => {
  const row = article();
  const apa = formatCitation(row, "https://paper.test/", "apa");
  assert.match(apa, /Núñez, J\./);
  assert.match(apa, /Lee, A\./);
  assert.match(apa, /Cells & signals <in vivo> "quoted"/);
  assert.match(apa, /\(2024\)/);
  assert.match(apa, /https:\/\/paper\.test\/posts\/cells-signals/);
  assert.equal(apa.includes("mongodb"), false);

  const mla = formatCitation(row, "https://paper.test", "mla");
  assert.match(mla, /José Núñez, et al\./);
  assert.match(mla, /Cells & signals <in vivo> "quoted"/);

  const chicago = formatCitation(row, "https://paper.test", "chicago");
  assert.match(chicago, /José Núñez, Ann Lee/);
});

test("BibTeX braces stay balanced when the title contains braces or quotes", () => {
  const bib = formatCitation(
    article({ title: `A {nested} "quote" & more.`, authors: ["Ada Lovelace"] }),
    "https://paper.test",
    "bibtex"
  );
  assert.match(bib, /author\s+= \{Ada Lovelace\}/);
  assert.match(bib, /year\s+= \{2024\}/);
  assert.equal((bib.match(/\{/g) || []).length, (bib.match(/\}/g) || []).length);
  assert.equal(bib.includes("\n\n"), false);
});

test("a missing date and missing authors have stable fallbacks", () => {
  const apa = formatCitation(
    article({ authors: [], published_at: null, created_at: undefined }),
    "https://paper.test",
    "apa"
  );
  assert.match(apa, /Trail, P\. \(n\.d\.\)/);
});
