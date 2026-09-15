import type { MetadataRoute } from "next";
import { getAllPublishedArticles } from "@/lib/articles";
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
