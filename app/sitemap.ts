import type { MetadataRoute } from "next";
import {
  getAllPublishedArticles,
  getPublishedAuthorCounts,
  getPublishedTagCounts,
} from "@/lib/articles";
import { slugifyLabel } from "@/lib/name-slug";
import { getSiteUrl } from "@/lib/site-url";

// The sitemap contains live database data and must not query Atlas at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  let articles: Awaited<ReturnType<typeof getAllPublishedArticles>> = [];

  try {
    articles = await getAllPublishedArticles(1000);
  } catch (error) {
    console.error("Failed to load sitemap articles:", error);
  }

  let tags: Awaited<ReturnType<typeof getPublishedTagCounts>> = [];
  let authors: Awaited<ReturnType<typeof getPublishedAuthorCounts>> = [];
  try {
    [tags, authors] = await Promise.all([
      getPublishedTagCounts(40),
      getPublishedAuthorCounts(40),
    ]);
  } catch (error) {
    console.error("Failed to load sitemap taxonomy:", error);
  }

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/posts/${article.slug}`,
    lastModified: article.published_at
      ? new Date(article.published_at)
      : article.created_at
        ? new Date(article.created_at)
        : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/newsletter`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/today`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/topics`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/authors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    ...tags.map((t) => ({
      url: `${baseUrl}/topics/${encodeURIComponent(slugifyLabel(t.tag))}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.45,
    })),
    ...authors.map((a) => ({
      url: `${baseUrl}/authors/${encodeURIComponent(slugifyLabel(a.name))}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...articleEntries,
  ];
}
