import type { ArticleRow } from "./prompts";

export function articleToMarkdown(article: ArticleRow, siteUrl: string): string {
  const source = article.source_url || "";
  const why = (article.why_it_matters || [])
    .map((point, i) => `${i + 1}. ${point}`)
    .join("\n");
  const authors = (article.authors || []).join(", ");
  const page = `${siteUrl.replace(/\/$/, "")}/posts/${article.slug}`;

  return [
    `# ${article.title}`,
    "",
    article.headline,
    "",
    authors ? `Authors: ${authors}` : "",
    source ? `Original paper: ${source}` : "",
    `Plain-language note: ${page}`,
    "",
    "## Why it matters",
    why || "_Not listed._",
    "",
    "## In plain language",
    article.plain_explanation || "",
    "",
    "## Editor's caveats",
    article.caveats || "",
    "",
    "---",
    "",
    "This is a Paper Trail editorial translation of a published paper, not the paper itself,",
    "and not medical, legal, or investment advice. Always read the original before relying on a claim.",
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim() + "\n";
}

export function markdownFilename(slug: string): string {
  const safe = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "note";
  return `${safe}.md`;
}
