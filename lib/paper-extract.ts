import { extractText, getDocumentProxy } from "unpdf";
import { normalizeCategory } from "./arxivCategories";

/**
 * Normalizes any arXiv URL (abs, pdf, or bare ID) into its
 * abstract-page URL and PDF URL.
 */
function resolveArxivUrls(input: string): { absUrl: string; pdfUrl: string; id: string } {
  const idMatch = input.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (!idMatch) {
    throw new Error("Could not find an arXiv ID in the provided URL.");
  }
  const id = idMatch[1];
  return {
    id,
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
  };
}

/**
 * Pulls title + abstract + primary category from arXiv's public API (fast,
 * reliable, no PDF parsing needed as a fallback if full-text extraction fails).
 */
async function fetchArxivMetadata(
  id: string
): Promise<{
  title: string;
  abstract: string;
  category: string | null;
  authors: string[];
  institutions: string[];
}> {
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${id}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`arXiv API request failed: ${res.status}`);
  const xml = await res.text();

  const title = xml.match(/<title>([\s\S]*?)<\/title>/g)?.[1]
    ?.replace(/<\/?title>/g, "")
    .replace(/\s+/g, " ")
    .trim() ?? "";
  const abstract = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
    ?.replace(/\s+/g, " ")
    .trim() ?? "";
  const rawCategory = xml.match(/primary_category[^>]*term="([^"]+)"/)?.[1] ?? null;
  const category = normalizeCategory(rawCategory);

  // Atom author blocks: <author><name>…</name><arxiv:affiliation>…</arxiv:affiliation></author>
  const authors: string[] = [];
  const institutions = new Set<string>();
  for (const block of xml.matchAll(/<author>([\s\S]*?)<\/author>/g)) {
    const chunk = block[1];
    const name = chunk
      .match(/<name>([\s\S]*?)<\/name>/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    if (name) authors.push(name);
    const aff = chunk
      .match(/<(?:arxiv:)?affiliation>([\s\S]*?)<\/(?:arxiv:)?affiliation>/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    if (aff) institutions.add(aff);
  }

  return {
    title,
    abstract,
    category,
    authors: authors.slice(0, 40),
    institutions: [...institutions].slice(0, 20),
  };
}

/**
 * Downloads the PDF and extracts raw text using unpdf (pure JS, works in
 * serverless/Node runtimes without native bindings).
 */
async function extractPdfText(pdfUrl: string): Promise<string> {
  const res = await fetch(pdfUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Failed to download PDF: ${res.status}`);
  const buffer = new Uint8Array(await res.arrayBuffer());

  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/**
 * Main entry point: given any paper URL, return the best available text
 * for summarization, truncated to a safe length for the LLM call.
 *
 * Currently optimized for arXiv. Falls back to abstract-only if full-text
 * PDF extraction fails (e.g. scanned/image-based PDFs).
 */
export async function extractPaperText(inputUrl: string): Promise<{
  title: string;
  sourceUrl: string;
  text: string;
  category: string | null;
  authors: string[];
  institutions: string[];
}> {
  const { absUrl, pdfUrl, id } = resolveArxivUrls(inputUrl);
  const { title, abstract, category, authors, institutions } = await fetchArxivMetadata(id);

  let fullText = "";
  try {
    fullText = await extractPdfText(pdfUrl);
  } catch (err) {
    console.warn(`PDF extraction failed for ${pdfUrl}, falling back to abstract only.`, err);
  }

  const text = fullText && fullText.length > abstract.length ? fullText : abstract;

  // Keep the payload sane for the LLM call (~12k chars ≈ safe token budget
  // for most models while leaving room for the system prompt + output).
  const MAX_CHARS = 12000;
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  return {
    title,
    sourceUrl: absUrl,
    text: trimmed,
    category,
    authors,
    institutions,
  };
}
