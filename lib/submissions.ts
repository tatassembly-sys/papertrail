import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";

export interface SubmissionDoc {
  _id: ObjectId;
  url: string;
  note?: string;
  status: "pending" | "processed" | "dismissed";
  ip_hash: string;
  submitted_at: Date;
}

export interface SubmissionRow {
  id: string;
  url: string;
  note?: string;
  status: SubmissionDoc["status"];
  submitted_at: string;
}

function toRow(doc: SubmissionDoc): SubmissionRow {
  return {
    id: doc._id.toString(),
    url: doc.url,
    note: doc.note,
    status: doc.status,
    submitted_at: doc.submitted_at.toISOString(),
  };
}

async function collection() {
  const db = await getDb();
  return db.collection<SubmissionDoc>("submissions");
}

/** @deprecated Import hashIp from `@/lib/request-ip` instead. */
export { hashIp } from "./request-ip";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3; // submissions per IP per window

export async function isRateLimited(ipHash: string): Promise<boolean> {
  const col = await collection();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await col.countDocuments({ ip_hash: ipHash, submitted_at: { $gte: since } });
  return count >= RATE_LIMIT_MAX;
}

export async function createSubmission(
  url: string,
  note: string | undefined,
  ipHash: string
): Promise<SubmissionRow> {
  const col = await collection();
  const doc: Omit<SubmissionDoc, "_id"> = {
    url,
    note,
    status: "pending",
    ip_hash: ipHash,
    submitted_at: new Date(),
  };
  const result = await col.insertOne(doc as SubmissionDoc);
  return toRow({ ...doc, _id: result.insertedId } as SubmissionDoc);
}

export async function getSubmissions(status?: SubmissionDoc["status"]): Promise<SubmissionRow[]> {
  const col = await collection();
  const filter = status ? { status } : {};
  const docs = await col.find(filter).sort({ submitted_at: -1 }).toArray();
  return docs.map(toRow);
}

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionDoc["status"]
): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await collection();
  const result = await col.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
  return result.modifiedCount > 0;
}

/** Cheap existence check so the same link can't flood the queue. */
export async function hasPendingSubmission(url: string): Promise<boolean> {
  const col = await collection();
  const existing = await col.findOne({ url, status: "pending" });
  return !!existing;
}
