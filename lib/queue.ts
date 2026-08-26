import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export type PaperSource = "arxiv" | "pubmed";

export interface QueueDoc {
  _id: ObjectId;
  source: PaperSource;
  external_id: string; // arXiv ID (e.g. "2401.12345") or PubMed PMID
  url: string;
  category?: string;
  status: "pending" | "processing" | "done" | "error";
  attempts: number;
  error_message?: string;
  created_at: Date;
  /** Set when a worker claims the row; used to reclaim stuck jobs. */
  processing_started_at?: Date;
}

/** Jobs left in "processing" longer than this are assumed crashed and reclaimed. */
const STUCK_PROCESSING_MS = 15 * 60 * 1000;

async function queueCollection() {
  const db = await getDb();
  return db.collection<QueueDoc>("fetch_queue");
}

export async function getQueuedExternalIds(
  source: PaperSource,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const col = await queueCollection();
  const docs = await col
    .find({ source, external_id: { $in: ids } }, { projection: { external_id: 1 } })
    .toArray();
  return new Set(docs.map((d) => d.external_id));
}

export async function enqueuePapers(
  source: PaperSource,
  entries: { externalId: string; url: string; category?: string }[]
): Promise<number> {
  if (entries.length === 0) return 0;
  const col = await queueCollection();
  try {
    const result = await col.insertMany(
      entries.map((e) => ({
        source,
        external_id: e.externalId,
        url: e.url,
        category: e.category,
        status: "pending" as const,
        attempts: 0,
        created_at: new Date(),
      })) as QueueDoc[],
      { ordered: false } // one duplicate-key failure shouldn't block the rest
    );
    return result.insertedCount;
  } catch (err: unknown) {
    // With ordered:false, partial inserts throw BulkWriteError but still succeed.
    // Treat that as success so cron runs don't 500 on expected duplicates.
    if (
      typeof err === "object" &&
      err !== null &&
      "insertedCount" in err &&
      typeof (err as { insertedCount: unknown }).insertedCount === "number"
    ) {
      return (err as { insertedCount: number }).insertedCount;
    }
    throw err;
  }
}

/**
 * Atomically claims up to `batchSize` pending rows by flipping each to
 * "processing" via findOneAndUpdate — atomic per-document, so overlapping
 * runs can't double-claim the same row (unlike a separate select-then-update).
 * Also reclaims jobs stuck in "processing" past STUCK_PROCESSING_MS.
 */
export async function claimQueueBatch(batchSize: number): Promise<QueueDoc[]> {
  const col = await queueCollection();
  const claimed: QueueDoc[] = [];
  const stuckBefore = new Date(Date.now() - STUCK_PROCESSING_MS);
  const claimFilter = {
    $or: [
      { status: "pending" as const },
      { status: "processing" as const, processing_started_at: { $lt: stuckBefore } },
      // Legacy rows claimed before processing_started_at existed.
      {
        status: "processing" as const,
        processing_started_at: { $exists: false },
        created_at: { $lt: stuckBefore },
      },
    ],
  };

  for (let i = 0; i < batchSize; i++) {
    const result = await col.findOneAndUpdate(
      claimFilter,
      { $set: { status: "processing", processing_started_at: new Date() } },
      { sort: { created_at: 1 }, returnDocument: "after" }
    );
    if (!result) break; // queue is empty
    claimed.push(result);
  }

  return claimed;
}

export async function markQueueDone(id: ObjectId): Promise<void> {
  const col = await queueCollection();
  await col.updateOne(
    { _id: id },
    { $set: { status: "done" }, $unset: { processing_started_at: "" } }
  );
}

export async function markQueueError(
  id: ObjectId,
  status: "pending" | "error",
  attempts: number,
  errorMessage: string
): Promise<void> {
  const col = await queueCollection();
  await col.updateOne(
    { _id: id },
    {
      $set: { status, attempts, error_message: errorMessage },
      $unset: { processing_started_at: "" },
    }
  );
}

/**
 * Return a claimed row to pending without burning an attempt.
 * Used for permanent config failures (e.g. invalid OpenRouter key) so the
 * pipeline can resume after ops fixes the env.
 */
export async function releaseQueueClaim(
  id: ObjectId,
  errorMessage?: string
): Promise<void> {
  const col = await queueCollection();
  const set: Record<string, unknown> = { status: "pending" };
  if (errorMessage) set.error_message = errorMessage;
  await col.updateOne(
    { _id: id },
    {
      $set: set,
      $unset: { processing_started_at: "" },
    }
  );
}
