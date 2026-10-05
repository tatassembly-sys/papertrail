import { NextRequest, NextResponse } from "next/server";
import { getExistingSourceUrls } from "@/lib/articles";
import { enqueuePapers, getQueuedExternalIds } from "@/lib/queue";
import { arxivFeedCategoriesFromEnv } from "@/lib/arxivCategories";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { publicErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs"; // needs the mongo driver's Node TCP APIs
export const maxDuration = 60; // many field feeds; keep under Railway cron budget

const ARXIV_CATEGORIES = arxivFeedCategoriesFromEnv();

interface FeedEntry {
  absUrl: string;
  arxivId: string;
  category: string;
}

async function fetchArxivLinksForCategory(category: string): Promise<FeedEntry[]> {
  const res = await fetch(`https://export.arxiv.org/rss/${category}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Failed to fetch arXiv RSS for ${category}: ${res.status}`);
  const xml = await res.text();

  const links = [...xml.matchAll(/<link>(https:\/\/arxiv\.org\/abs\/[^<]+)<\/link>/g)].map(
    (m) => m[1].trim()
  );

  const entries: FeedEntry[] = [];
  for (const absUrl of links) {
    const idMatch = absUrl.match(/(\d{4}\.\d{4,5})/);
    if (!idMatch) continue;
    entries.push({ absUrl: `https://arxiv.org/abs/${idMatch[1]}`, arxivId: idMatch[1], category });
  }
  return entries;
}

async function fetchRecentArxivLinks(): Promise<FeedEntry[]> {
  const results = await Promise.allSettled(ARXIV_CATEGORIES.map(fetchArxivLinksForCategory));

  const seen = new Set<string>();
  const entries: FeedEntry[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn("arXiv category fetch failed:", result.reason);
      continue;
    }
    for (const entry of result.value) {
      // A paper can be cross-listed in multiple categories we poll — keep
      // the first (category order above is roughly priority order).
      if (seen.has(entry.arxivId)) continue;
      seen.add(entry.arxivId);
      entries.push(entry);
    }
  }

  return entries;
}

export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  try {
    const entries = await fetchRecentArxivLinks();

    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        categories: ARXIV_CATEGORIES,
        found: 0,
        enqueued: 0,
        note: "No entries found — all category feeds may have failed to fetch.",
      });
    }

    const [existingUrls, queuedIds] = await Promise.all([
      getExistingSourceUrls(entries.map((e) => e.absUrl)),
      getQueuedExternalIds("arxiv", entries.map((e) => e.arxivId)),
    ]);

    const toEnqueue = entries.filter(
      (e) => !existingUrls.has(e.absUrl) && !queuedIds.has(e.arxivId)
    );

    const enqueuedCount = await enqueuePapers(
      "arxiv",
      toEnqueue.map((e) => ({ externalId: e.arxivId, url: e.absUrl, category: e.category }))
    );

    return NextResponse.json({
      success: true,
      categories: ARXIV_CATEGORIES,
      found: entries.length,
      enqueued: enqueuedCount,
    });
  } catch (err) {
    console.error("cron-fetch:", err);
    return NextResponse.json(
      { error: publicErrorMessage(err, "Cron fetch failed.") },
      { status: 500 }
    );
  }
}
