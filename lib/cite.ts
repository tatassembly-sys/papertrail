import type { ArticleRow } from "./prompts";

export type CiteStyle = "apa" | "mla" | "chicago" | "bibtex";

function yearOf(article: ArticleRow): string {
  const raw = article.published_at || article.created_at;
  if (!raw) return "n.d.";
  const y = new Date(raw).getFullYear();
  return Number.isFinite(y) ? String(y) : "n.d.";
}

function authorsList(article: ArticleRow): string[] {
  const authors = (article.authors || []).map((a) => a.trim()).filter(Boolean);
  return authors.length ? authors : ["Paper Trail"];
}

function apaAuthors(names: string[]): string {
  const formatted = names.map((name) => {
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => `${p.charAt(0).toUpperCase()}.`)
      .join(" ");
    return `${last}, ${initials}`;
  });
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function bibtexKey(article: ArticleRow): string {
  const last = (authorsList(article)[0] || "paper")
    .split(/\s+/)
    .slice(-1)[0]
    .replace(/[^a-zA-Z]/g, "");
  return `${last || "paper"}${yearOf(article)}${(article.slug || "").replace(/-/g, "").slice(0, 12)}`;
}

export function formatCitation(
  article: ArticleRow,
  siteUrl: string,
  style: CiteStyle
): string {
  const names = authorsList(article);
  const year = yearOf(article);
  const url = `${siteUrl.replace(/\/$/, "")}/posts/${article.slug}`;
  const source = article.source_url || url;
  const title = article.title.replace(/\.$/, "");

  if (style === "apa") {
    return `${apaAuthors(names)} (${year}). ${title}. Paper Trail. ${url}`;
  }
  if (style === "mla") {
    const mlaNames =
      names.length === 1
        ? names[0]
        : `${names[0]}, et al.`;
    return `${mlaNames}. "${title}." Paper Trail, ${year}, ${url}.`;
  }
  if (style === "chicago") {
    return `${names.join(", ")}. "${title}." Paper Trail. ${year}. ${url}.`;
  }
  const bibAuthors = names.join(" and ");
  return `@article{${bibtexKey(article)},
  title     = {${title}},
  author    = {${bibAuthors}},
  year      = {${year === "n.d." ? "" : year}},
  journal   = {Paper Trail},
  url       = {${url}},
  note      = {Plain-language note. Original: ${source}}
}`;
}

export const CITE_STYLES: { id: CiteStyle; label: string }[] = [
  { id: "apa", label: "APA" },
  { id: "mla", label: "MLA" },
  { id: "chicago", label: "Chicago" },
  { id: "bibtex", label: "BibTeX" },
];
