import { NextRequest, NextResponse } from "next/server";
import { suggestPublishedArticles } from "@/lib/articles";
import { categoryLabel } from "@/lib/arxivCategories";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }

  const ipKey = hashIp(getClientIp(req));
  if (await hitRateLimit("search-suggest", ipKey, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many searches." }, { status: 429 });
  }

  try {
    const articles = await suggestPublishedArticles(q, 6);
    return NextResponse.json({
      suggestions: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        headline: a.headline,
        category: a.category ? categoryLabel(a.category) : null,
      })),
    });
  } catch (err) {
    console.error("search suggest:", err);
    return NextResponse.json({ suggestions: [] });
  }
}