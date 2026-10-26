import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// M8.5: self-hosted next/font with swap, fixed-size OG images, and card images
// reserve their box (aspect ratio + fill) so nothing shifts on load.
test("fonts come from next/font with display swap", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /from "next\/font\/google"/);
  assert.equal((layout.match(/display: "swap"/g) || []).length >= 3, true);
  const css = readFileSync("app/globals.css", "utf8");
  assert.ok(!css.includes("fonts.googleapis.com"));
});

test("OG images have a fixed 1200x630 size and cards reserve the image box", () => {
  const og = readFileSync("app/opengraph-image.tsx", "utf8");
  assert.match(og, /width: 1200, height: 630/);
  const card = readFileSync("components/ArticleCard.tsx", "utf8");
  assert.match(card, /aspect-\[1\.91\/1\]/);
  assert.match(card, /\bfill\b/);
  assert.match(card, /sizes=/);
});
