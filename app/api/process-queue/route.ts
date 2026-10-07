import { NextRequest, NextResponse } from "next/server";
import { extractPaperText } from "@/lib/paper-extract";
import { extractPubMedText } from "@/lib/pubmed";
import { translatePaperToArticle } from "@/lib/openrouter";
import { isOpenRouterConfigError } from "@/lib/openrouter-health";
import { insertDraftArticle } from "@/lib/articles";
import {
  claimQueueBatch,
  markQueueDone,
  markQueueError,
  releaseQueueClaim,
} from "@/lib/queue";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { runCronJob } from "@/lib/cron-run";

export const runtime = "nodejs";
export const maxDuration = 120;

const BATCH_SIZE = 1; // one paper per tick — OpenRouter + PDF can exhaust maxDuration
const MAX_ATTEMPTS = 3;
const MIN_TEXT_LENGTH = 200;

export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  return runCronJob("process-queue", async () => {
  const results: {
    externalId: string;
    source: string;
    status: string;
    error?: string;
  }[] = [];

  // findOneAndUpdate per row is atomic, so overlapping runs can't double-claim.
  const batch = await claimQueueBatch(BATCH_SIZE);
  const finished = new Set<string>();

  if (batch.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: "Queue empty." });
  }

  try {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      let title: string;
      let sourceUrl: string;
      let text: string;
      let category: string | null;

      let authors: string[] = [];
      let institutions: string[] = [];

      if (row.source === "pubmed") {
        const result = await extractPubMedText(row.external_id);
        title = result.title;
        sourceUrl = result.sourceUrl;
        text = result.text;
        category = row.category || null;
        authors = result.authors || [];
      } else {
        const result = await extractPaperText(row.url);
        title = result.title;
        sourceUrl = result.sourceUrl;
        text = result.text;
        category = row.category || result.category;
        authors = result.authors || [];
        institutions = result.institutions || [];
      }

      if (!text || text.length < MIN_TEXT_LENGTH) {
        await markQueueError(row._id, "error", row.attempts, "insufficient extractable text");
        finished.add(row._id.toString());
        results.push({
          externalId: row.external_id,
          source: row.source,
          status: "error",
          error: "insufficient text",
        });
        continue;
      }

      const article = await translatePaperToArticle(text, { fallbackTitle: title });
      await insertDraftArticle(article, sourceUrl, title, category, {
        source: row.source === "pubmed" ? "pubmed" : "arxiv",
        authors,
        institutions,
      });

      await markQueueDone(row._id);
      finished.add(row._id.toString());
      results.push({ externalId: row.external_id, source: row.source, status: "drafted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";

      // Permanent config failure: don't burn attempt budget; release the rest of the batch.
      if (isOpenRouterConfigError(message)) {
        await releaseQueueClaim(row._id, message);
        finished.add(row._id.toString());
        results.push({
          externalId: row.external_id,
          source: row.source,
          status: "released",
          error: message,
        });

        for (let j = i + 1; j < batch.length; j++) {
          const rest = batch[j];
          await releaseQueueClaim(rest._id, "Skipped: OpenRouter not configured (batch aborted).");
          finished.add(rest._id.toString());
          results.push({
            externalId: rest.external_id,
            source: rest.source,
            status: "released",
            error: "batch aborted (OpenRouter config)",
          });
        }

        return NextResponse.json({
          success: false,
          processed: results.length,
          aborted: true,
          reason: "openrouter_config",
          message,
          results,
        });
      }

      const attempts = row.attempts;
      const nextStatus = attempts >= MAX_ATTEMPTS ? "error" : "pending";

      await markQueueError(row._id, nextStatus, attempts, message);
      finished.add(row._id.toString());
      results.push({
        externalId: row.external_id,
        source: row.source,
        status: nextStatus,
        error: message,
      });
    }
  }

  return NextResponse.json({ success: true, processed: batch.length, results });
  } catch (err) {
    console.error("process-queue crashed:", err);
    for (const row of batch) {
      if (!finished.has(row._id.toString())) {
        await releaseQueueClaim(row._id, "Worker aborted; claim released.");
      }
    }
    return NextResponse.json(
      { error: "Queue worker failed.", processed: results.length, results },
      { status: 500 }
    );
  }
  });
}
