// NCBI E-utilities: free, public, no API key required for this volume of
// requests. Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
// NCBI asks callers to identify themselves via `tool` and `email` params —
// polite, and avoids rate-limit surprises. Set PUBMED_CONTACT_EMAIL if you
// have one; it's not required for basic use, just recommended by NCBI.

const TOOL_NAME = process.env.PUBMED_TOOL_NAME || "paper-trail";
const CONTACT_EMAIL = process.env.PUBMED_CONTACT_EMAIL || "";

function withIdentity(params: URLSearchParams): URLSearchParams {
  params.set("tool", TOOL_NAME);
  if (CONTACT_EMAIL) params.set("email", CONTACT_EMAIL);
  return params;
}

export interface PubMedEntry {
  pmid: string;
  url: string;
}

/** Searches PubMed for a topic, returning the most recent matching PMIDs. */
export async function searchPubMedIds(topic: string, maxResults = 10): Promise<PubMedEntry[]> {
  const params = withIdentity(
    new URLSearchParams({
      db: "pubmed",
      term: topic,
      retmode: "json",
      retmax: String(maxResults),
      sort: "date",
    })
  );

  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`PubMed search failed for "${topic}": ${res.status}`);
  const data = await res.json();
  const ids: string[] = data?.esearchresult?.idlist || [];

  return ids.map((pmid) => ({ pmid, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` }));
}

interface PubMedArticleData {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
}

/** Fetches title + abstract for a batch of PMIDs in one request. */
export async function fetchPubMedArticles(pmids: string[]): Promise<PubMedArticleData[]> {
  if (pmids.length === 0) return [];

  const params = withIdentity(
    new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      rettype: "abstract",
      retmode: "xml",
    })
  );

  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`PubMed fetch failed: ${res.status}`);
  const xml = await res.text();

  const articleBlocks = xml.split("<PubmedArticle>").slice(1);
  const results: PubMedArticleData[] = [];

  for (const block of articleBlocks) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    const title = block
      .match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)?.[1]
      ?.replace(/<[^>]+>/g, "") // strip any inline tags (italics, etc.)
      .replace(/\s+/g, " ")
      .trim();

    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(
      (m) => m[1].replace(/<[^>]+>/g, "").trim()
    );
    const abstract = abstractParts.join(" ").replace(/\s+/g, " ").trim();

    const authors: string[] = [];
    for (const authorBlock of block.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g)) {
      const chunk = authorBlock[1];
      const collective = chunk
        .match(/<CollectiveName>([\s\S]*?)<\/CollectiveName>/)?.[1]
        ?.replace(/\s+/g, " ")
        .trim();
      if (collective) {
        authors.push(collective);
        continue;
      }
      const last = chunk.match(/<LastName>([\s\S]*?)<\/LastName>/)?.[1]?.trim();
      const fore = chunk.match(/<ForeName>([\s\S]*?)<\/ForeName>/)?.[1]?.trim();
      const initials = chunk.match(/<Initials>([\s\S]*?)<\/Initials>/)?.[1]?.trim();
      if (last && fore) authors.push(`${fore} ${last}`);
      else if (last && initials) authors.push(`${initials} ${last}`);
      else if (last) authors.push(last);
    }

    if (pmid && title && abstract) {
      results.push({ pmid, title, abstract, authors: authors.slice(0, 40) });
    }
  }

  return results;
}

/**
 * Matches the shape of extractPaperText so the queue worker can handle both
 * sources with one code path. PubMed is abstract-only by design.
 */
export async function extractPubMedText(pmid: string): Promise<{
  title: string;
  sourceUrl: string;
  text: string;
  authors: string[];
}> {
  const [article] = await fetchPubMedArticles([pmid]);
  if (!article) {
    throw new Error(`No PubMed article found for PMID ${pmid}`);
  }
  return {
    title: article.title,
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    text: article.abstract,
    authors: article.authors || [],
  };
}
