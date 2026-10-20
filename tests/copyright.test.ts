import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ARXIV_DEFAULT_LICENCE,
  FULL_TEXT_REFUSAL,
  filingBody,
  isOpenContentLicence,
  licenceCreditLabel,
  licenceFromArxivXml,
  sourceFingerprint,
} from "../lib/copyright";
import { draftFromExtract } from "../lib/extract-draft";
import { publishBlocker } from "../lib/publish-gate";

const RAW = "The original paper reports the following methods and results in full. ".repeat(40);

test("closed licence keeps an excerpt instead of the raw paper", () => {
  assert.equal(isOpenContentLicence(ARXIV_DEFAULT_LICENCE), false);
  assert.equal(isOpenContentLicence("https://creativecommons.org/licenses/by-nc/4.0/"), false);
  assert.equal(isOpenContentLicence("https://creativecommons.org/licenses/by/4.0/"), true);
  assert.equal(isOpenContentLicence("CC0"), true);

  const filed = filingBody({ licence: ARXIV_DEFAULT_LICENCE, text: RAW, kind: "pdf" });
  assert.equal(filed.refusedFullText, true);
  assert.ok(filed.body.length < 900);
  assert.match(filed.body, /short excerpt/);

  const draft = draftFromExtract(RAW, "Closed paper", {
    licence: ARXIV_DEFAULT_LICENCE,
    kind: "pdf",
  });
  assert.ok(draft.plain_explanation.length < 900);
  assert.match(draft.plain_explanation, /short excerpt/);

  const open = filingBody({
    licence: "https://creativecommons.org/licenses/by-sa/4.0/",
    text: RAW,
    kind: "pdf",
  });
  assert.equal(open.refusedFullText, false);
  assert.ok(open.body.length > 900);

  const note = filingBody({
    licence: "all rights reserved",
    text: "A plain note about the study, not the paper itself.",
    kind: "plain-english",
  });
  assert.equal(note.refusedFullText, false);
  assert.equal(note.body, "A plain note about the study, not the paper itself.");
});

test("publish refuses a non-open full text and allows an open one", () => {
  const finger = sourceFingerprint(RAW);
  assert.equal(
    publishBlocker({
      sourceUrl: "https://arxiv.org/abs/2401.00001",
      caveats: "n=12",
      licence: ARXIV_DEFAULT_LICENCE,
      plainExplanation: RAW,
      sourceFingerprint: finger,
    }),
    FULL_TEXT_REFUSAL
  );
  assert.equal(
    publishBlocker({
      sourceUrl: "https://arxiv.org/abs/2401.00001",
      caveats: "n=12",
      licence: "https://creativecommons.org/licenses/by/4.0/",
      plainExplanation: RAW,
      sourceFingerprint: finger,
    }),
    null
  );
  const excerpt = filingBody({ licence: null, text: RAW, kind: "pdf" }).body;
  assert.equal(
    publishBlocker({
      sourceUrl: "https://arxiv.org/abs/2401.00001",
      caveats: "n=12",
      licence: null,
      plainExplanation: excerpt,
      sourceFingerprint: finger,
    }),
    null
  );
});

test("article page credits the paper, authors, licence, and link", () => {
  const page = readFileSync("app/posts/[slug]/page.tsx", "utf8");
  assert.match(page, /Source credit/);
  assert.match(page, /Authors:/);
  assert.match(page, /article\.authors/);
  assert.match(page, /licenceCreditLabel\(article\.licence\)/);
  assert.match(page, /Read the original paper/);
  assert.match(page, /href=\{sourceHref\}/);
  const xml =
    '<entry><arxiv:license>https://creativecommons.org/licenses/by/4.0/</arxiv:license></entry>';
  assert.equal(licenceFromArxivXml(xml), "https://creativecommons.org/licenses/by/4.0/");
  assert.match(licenceCreditLabel(null), /not republished/);
});
