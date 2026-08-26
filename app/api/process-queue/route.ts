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

export const runtime = "nodejs";
export const maxDuration = 120;

const BATCH_SIZE = 3; // small batch — this route runs frequently, keep each run cheap
const MAX_ATTEMPTS = 3;
const MIN_TEXT_LENGTH = 200;

export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const results: {
    externalId: string;
    source: string;
    status: string;
    error?: string;
  }[] = [];

  // findOneAndUpdate per row is atomic, so overlapping runs can't double-claim.
  const batch = await claimQueueBatch(BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: "Queue empty." });
  }

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
      results.push({ externalId: row.external_id, source: row.source, status: "drafted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";

      // Permanent config failure: don't burn attempt budget; release the rest of the batch.
      if (isOpenRouterConfigError(message)) {
        await releaseQueueClaim(row._id, message);
        results.push({
          externalId: row.external_id,
          source: row.source,
          status: "released",
          error: message,
        });

        for (let j = i + 1; j < batch.length; j++) {
          const rest = batch[j];
          await releaseQueueClaim(rest._id, "Skipped: OpenRouter not configured (batch aborted).");
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

      const attempts = row.attempts + 1;
      const nextStatus = attempts >= MAX_ATTEMPTS ? "error" : "pending";

      await markQueueError(row._id, nextStatus, attempts, message);
      results.push({
        externalId: row.external_id,
        source: row.source,
        status: nextStatus,
        error: message,
      });
    }
  }

  return NextResponse.json({ success: true, processed: batch.length, results });
}
