/** How much of a non-open paper may be stored as the note body. */
export const CLOSED_LICENCE_EXCERPT_CHARS = 480;

/** Longer than this, a verbatim copy of the source is treated as the full text. */
export const CLOSED_LICENCE_BODY_MAX = 900;

export const FULL_TEXT_REFUSAL =
  "Refusing to publish the full text of a paper that is not under an open licence. Store a short excerpt or a plain-English note instead.";

/** arXiv's default distribution licence is not a licence to republish the paper. */
export const ARXIV_DEFAULT_LICENCE =
  "http://arxiv.org/licenses/nonexclusive-distrib/1.0/";

const OPEN_LICENCE =
  /creativecommons\.org\/licenses\/by(?:-sa)?\/|creativecommons\.org\/publicdomain\/zero\/|\bcc0\b|\bpublic\s+domain\b|\bcc[\s-]?by(?:[\s-]?sa)?(?:[\s-]?(?:4\.0|3\.0|2\.0|2\.5))?\b/i;

export type SourceTextKind = "plain-english" | "abstract" | "pdf";

/** CC BY, CC BY-SA, CC0, and public domain. CC BY-NC is not open for this site. */
export function isOpenContentLicence(value: string | null | undefined): boolean {
  const text = (value || "").trim();
  if (!text) return false;
  if (/by[\s-]?nc|noncommercial/i.test(text)) return false;
  if (/nonexclusive-distrib|all rights reserved/i.test(text) && !OPEN_LICENCE.test(text)) {
    return false;
  }
  return OPEN_LICENCE.test(text);
}

export function licenceCreditLabel(value: string | null | undefined): string {
  const text = (value || "").trim();
  if (!text) return "Licence not recorded — full text is not republished";
  if (isOpenContentLicence(text)) return text;
  return `${text} (not an open licence; this page is a note or short excerpt, not the full paper)`;
}

/** Pull a licence URL out of one arXiv Atom entry. Null when the feed omits it. */
export function licenceFromArxivXml(xml: string): string | null {
  const tagged = xml
    .match(/<(?:[\w-]+:)?license[^>]*>\s*([^<]+?)\s*<\/(?:[\w-]+:)?license>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  if (tagged) return tagged.slice(0, 300);
  const href =
    xml.match(/<link\b[^>]*\brel=["']license["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] ||
    xml.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']license["']/i)?.[1];
  return href?.trim().slice(0, 300) || null;
}

export function sourceFingerprint(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 180);
}

export function closedLicenceFullTextError(input: {
  licence?: string | null;
  body?: string | null;
  sourceText?: string | null;
  sourceFingerprint?: string | null;
}): string | null {
  if (isOpenContentLicence(input.licence)) return null;
  const bodyNorm = (input.body || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (bodyNorm.length <= CLOSED_LICENCE_BODY_MAX) return null;
  const finger = (
    input.sourceFingerprint || (input.sourceText ? sourceFingerprint(input.sourceText) : "")
  )
    .trim()
    .toLowerCase();
  if (finger.length < 80) return null;
  if (bodyNorm.includes(finger)) return FULL_TEXT_REFUSAL;
  return null;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function excerptInsteadOfFullText(
  text: string,
  max = CLOSED_LICENCE_EXCERPT_CHARS
): string {
  const slice = clip(text, max);
  return `${slice}\n\nThis is a short excerpt, not the full paper. Read the source for the complete text.`;
}

/**
 * What may be stored as the note. A plain-English rewrite is kept.
 * An abstract is already an excerpt. Raw PDF text is excerpted unless the licence is open.
 */
export function filingBody(input: {
  licence?: string | null;
  text: string;
  kind: SourceTextKind;
}): { body: string; refusedFullText: boolean; fingerprint: string } {
  const text = input.text.replace(/\s+/g, " ").trim();
  const fingerprint = input.kind === "pdf" ? sourceFingerprint(text) : "";
  if (input.kind === "plain-english") {
    return { body: text, refusedFullText: false, fingerprint: "" };
  }
  if (input.kind === "abstract") {
    return { body: clip(text, 4000), refusedFullText: false, fingerprint: "" };
  }
  if (isOpenContentLicence(input.licence)) {
    return { body: clip(text, 4000), refusedFullText: false, fingerprint };
  }
  if (text.length <= CLOSED_LICENCE_EXCERPT_CHARS) {
    return { body: text, refusedFullText: false, fingerprint };
  }
  return {
    body: excerptInsteadOfFullText(text),
    refusedFullText: true,
    fingerprint,
  };
}

/** If a model pasted the PDF back, keep an excerpt instead. */
export function guardModelBody(input: {
  licence?: string | null;
  body: string;
  sourceText: string;
  sourceIsPdf: boolean;
}): { body: string; refusedFullText: boolean; fingerprint: string } {
  const fingerprint = input.sourceIsPdf ? sourceFingerprint(input.sourceText) : "";
  const error = closedLicenceFullTextError({
    licence: input.licence,
    body: input.body,
    sourceFingerprint: fingerprint,
  });
  if (!error) return { body: input.body, refusedFullText: false, fingerprint };
  return {
    body: excerptInsteadOfFullText(input.sourceText),
    refusedFullText: true,
    fingerprint,
  };
}
