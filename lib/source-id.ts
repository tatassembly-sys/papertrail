const ARXIV_IN_TEXT = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i;
const PMID_IN_TEXT = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,12})/i;

/** Stable arXiv id or PMID. Versions collapse so abs and pdf cannot double-file. */
export function canonicalSourceId(input: {
  externalId?: string | null;
  sourceUrl?: string | null;
}): string | null {
  const explicit = input.externalId?.trim() ?? "";
  if (explicit) {
    const arxiv = explicit.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
    if (arxiv) return arxiv[1];
    const pmid = explicit.match(/^(\d{1,12})$/);
    if (pmid) return pmid[1];
  }
  const url = input.sourceUrl?.trim() ?? "";
  if (!url) return null;
  const fromArxiv = url.match(ARXIV_IN_TEXT);
  if (fromArxiv) return fromArxiv[1];
  const fromPmid = url.match(PMID_IN_TEXT);
  if (fromPmid) return fromPmid[1];
  return null;
}
