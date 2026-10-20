import type { Metadata } from "next";

type PostMetaSource = {
  slug: string;
  title: string;
  headline: string;
  status?: string | null;
};

/** Canonical URL for a published note. Drafts and missing slugs are omitted. */
export function canonicalPostUrl(
  article: { slug?: string | null; status?: string | null } | null | undefined,
  siteUrl: string
): string | null {
  if (!article) return null;
  if (article.status != null && article.status !== "published") return null;
  const slug = article.slug?.trim();
  if (!slug) return null;
  return `${siteUrl.replace(/\/$/, "")}/posts/${slug}`;
}

export interface SitemapArticleInput {
  slug?: string | null;
  status?: string | null;
  published_at?: string | Date | null;
  created_at?: string | Date | null;
}

/** Sitemap rows for published notes only. Unpublished and blank slugs are dropped. */
export function publishedSitemapArticles(
  articles: readonly SitemapArticleInput[],
  baseUrl: string
): { url: string; lastModified?: Date; changeFrequency: "monthly"; priority: number }[] {
  const entries: { url: string; lastModified?: Date; changeFrequency: "monthly"; priority: number }[] = [];
  for (const article of articles) {
    if (article?.status !== "published") continue;
    const url = canonicalPostUrl(article, baseUrl);
    if (!url) continue;
    const stamp = article.published_at || article.created_at;
    const lastModified = stamp ? new Date(stamp) : undefined;
    entries.push({
      url,
      lastModified:
        lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : undefined,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  return entries;
}

/** Metadata for a published note. A missing note must not call notFound() here. */
export function postPageMetadata(article: PostMetaSource | null, siteUrl: string): Metadata {
  const url = canonicalPostUrl(article, siteUrl);
  if (!article || !url) {
    return {
      title: "Not on file",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: article.title,
    description: article.headline,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.headline,
      type: "article",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.headline,
    },
  };
}
