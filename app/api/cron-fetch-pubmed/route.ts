import { NextRequest, NextResponse } from "next/server";
import { getExistingSourceUrls } from "@/lib/articles";
import { enqueuePapers, getQueuedExternalIds } from "@/lib/queue";
import { searchPubMedIds } from "@/lib/pubmed";
import { PUBMED_TOPICS } from "@/lib/arxivCategories";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { publicErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs";
export const maxDuration = 30;

const RESULTS_PER_TOPIC = 10;

export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  try {
    const perTopicResults = await Promise.allSettled(
      PUBMED_TOPICS.map(async ({ topic, category }) => {
        const entries = await searchPubMedIds(topic, RESULTS_PER_TOPIC);
        return entries.map((e) => ({ ...e, category }));
      })
    );

    const seen = new Set<string>();
    const allEntries: { pmid: string; url: string; category: string }[] = [];

    for (const result of perTopicResults) {
      if (result.status !== "fulfilled") {
        console.warn("PubMed topic search failed:", result.reason);
        continue;
      }
      for (const entry of result.value) {
        if (seen.has(entry.pmid)) continue;
        seen.add(entry.pmid);
        allEntries.push(entry);
      }
    }

    if (allEntries.length === 0) {
      return NextResponse.json({
        success: true,
        topics: PUBMED_TOPICS.map((t) => t.topic),
        found: 0,
        enqueued: 0,
      });
    }

    const [existingUrls, queuedIds] = await Promise.all([
      getExistingSourceUrls(allEntries.map((e) => e.url)),
      getQueuedExternalIds("pubmed", allEntries.map((e) => e.pmid)),
    ]);

    const toEnqueue = allEntries.filter(
      (e) => !existingUrls.has(e.url) && !queuedIds.has(e.pmid)
    );

    const enqueuedCount = await enqueuePapers(
      "pubmed",
      toEnqueue.map((e) => ({ externalId: e.pmid, url: e.url, category: e.category }))
    );

    return NextResponse.json({
      success: true,
      topics: PUBMED_TOPICS.map((t) => t.topic),
      found: allEntries.length,
      enqueued: enqueuedCount,
    });
  } catch (err) {
    console.error("cron-fetch-pubmed:", err);
    return NextResponse.json(
      { error: publicErrorMessage(err, "Cron fetch failed.") },
      { status: 500 }
    );
  }
}
