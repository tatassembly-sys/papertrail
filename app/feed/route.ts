import { NextRequest } from "next/server";
import { getAllPublishedArticles, getPublishedArticles } from "@/lib/articles";
import { getSiteUrl } from "@/lib/site-url";
import { parseSearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: NextRequest) {
  const baseUrl = getSiteUrl();
  const filters = parseSearchParams(Object.fromEntries(req.nextUrl.searchParams));
  let articles: Awaited<ReturnType<typeof getAllPublishedArticles>> = [];

  try {
    if (filters.category || filters.tag || filters.author) {
      const result = await getPublishedArticles(1, 50, filters);
      articles = result.articles;
    } else {
      articles = await getAllPublishedArticles(50);
    }
  } catch (error) {
    console.error("Failed to load feed articles:", error);
  }

  const items = articles
    .map(
      (article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${baseUrl}/posts/${article.slug}</link>
      <guid>${baseUrl}/posts/${article.slug}</guid>
      <description>${escapeXml(article.headline)}</description>
      <pubDate>${new Date(article.published_at || article.created_at || Date.now()).toUTCString()}</pubDate>
    </item>`
    )
    .join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Paper Trail — Research, Translated${filters.category ? ` · ${escapeXml(filters.category)}` : filters.tag ? ` · ${escapeXml(filters.tag)}` : ""}</title>
    <link>${baseUrl}</link>
    <atom:link href="${escapeXml(`${baseUrl}/feed.xml${req.nextUrl.search}`)}" rel="self" type="application/rss+xml"/>
    <description>Dense academic papers, translated into plain language for curious readers.</description>
    <language>en-us</language>${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
