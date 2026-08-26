import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";

export interface ScheduledPostDoc {
  _id: ObjectId;
  article_id: ObjectId;
  platform: string;
  scheduled_for: Date;
  status: "pending" | "processing" | "sent" | "error" | "canceled";
  attempts: number;
  error_message?: string;
  created_at: Date;
  processing_started_at?: Date;
}

export interface ScheduledPostRow {
  id: string;
  article_id: string;
  platform: string;
  scheduled_for: string;
  status: ScheduledPostDoc["status"];
  attempts: number;
  error_message?: string;
}

const STUCK_PROCESSING_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function toRow(doc: ScheduledPostDoc): ScheduledPostRow {
  return {
    id: doc._id.toString(),
    article_id: doc.article_id.toString(),
    platform: doc.platform,
    scheduled_for: doc.scheduled_for.toISOString(),
    status: doc.status,
    attempts: doc.attempts,
    error_message: doc.error_message,
  };
}

async function collection() {
  const db = await getDb();
  return db.collection<ScheduledPostDoc>("scheduled_posts");
}

export async function createScheduledPost(
  articleId: string,
  platform: string,
  scheduledFor: Date
): Promise<ScheduledPostRow> {
  if (!isValidObjectId(articleId)) {
    throw new Error("Invalid article id.");
  }
  const col = await collection();
  const doc: Omit<ScheduledPostDoc, "_id"> = {
    article_id: new ObjectId(articleId),
    platform,
    scheduled_for: scheduledFor,
    status: "pending",
    attempts: 0,
    created_at: new Date(),
  };
  const result = await col.insertOne(doc as ScheduledPostDoc);
  return toRow({ ...doc, _id: result.insertedId } as ScheduledPostDoc);
}

export async function getScheduledPostsForArticle(articleId: string): Promise<ScheduledPostRow[]> {
  if (!isValidObjectId(articleId)) return [];
  const col = await collection();
  const docs = await col
    .find({ article_id: new ObjectId(articleId), status: { $in: ["pending", "processing"] } })
    .sort({ scheduled_for: 1 })
    .toArray();
  return docs.map(toRow);
}

export async function cancelScheduledPost(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await collection();
  const result = await col.updateOne(
    { _id: new ObjectId(id), status: "pending" },
    { $set: { status: "canceled" } }
  );
  return result.modifiedCount > 0;
}

/**
 * Atomically claims due, pending scheduled posts — same per-document
 * findOneAndUpdate pattern as the fetch_queue, so overlapping worker
 * runs can't double-post the same thing. Also reclaims stuck processing.
 */
export async function claimDueScheduledPosts(batchSize: number): Promise<ScheduledPostDoc[]> {
  const col = await collection();
  const claimed: ScheduledPostDoc[] = [];
  const now = new Date();
  const stuckBefore = new Date(Date.now() - STUCK_PROCESSING_MS);

  const claimFilter = {
    scheduled_for: { $lte: now },
    $or: [
      { status: "pending" as const },
      { status: "processing" as const, processing_started_at: { $lt: stuckBefore } },
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
      { sort: { scheduled_for: 1 }, returnDocument: "after" }
    );
    if (!result) break;
    claimed.push(result);
  }

  return claimed;
}

export async function markScheduledSent(id: ObjectId): Promise<void> {
  const col = await collection();
  await col.updateOne(
    { _id: id },
    { $set: { status: "sent" }, $unset: { processing_started_at: "" } }
  );
}

export async function markScheduledError(
  id: ObjectId,
  attempts: number,
  message: string
): Promise<void> {
  const col = await collection();
  const status = attempts >= MAX_ATTEMPTS ? "error" : "pending";
  await col.updateOne(
    { _id: id },
    {
      $set: { status, attempts, error_message: message },
      $unset: { processing_started_at: "" },
    }
  );
}
