import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { entitlementsFor, type PlanUser } from "./entitlements";

export const FREE_HIGHLIGHTS = 15;
export const PRO_HIGHLIGHTS = 500;

export interface HighlightDoc {
  _id: ObjectId;
  user_id: string;
  article_slug: string;
  quote: string;
  note: string;
  created_at: Date;
}

export interface HighlightRow {
  id: string;
  user_id: string;
  article_slug: string;
  quote: string;
  note: string;
  created_at: string;
}

function toRow(doc: HighlightDoc): HighlightRow {
  return {
    id: doc._id.toString(),
    user_id: doc.user_id,
    article_slug: doc.article_slug,
    quote: doc.quote,
    note: doc.note || "",
    created_at: doc.created_at.toISOString(),
  };
}

async function collection() {
  const db = await getDb();
  return db.collection<HighlightDoc>("highlights");
}

export async function listHighlights(
  userId: string,
  articleSlug?: string
): Promise<HighlightRow[]> {
  const col = await collection();
  const filter: Record<string, unknown> = { user_id: userId };
  if (articleSlug) filter.article_slug = articleSlug;
  const docs = await col.find(filter).sort({ created_at: -1 }).limit(200).toArray();
  return docs.map(toRow);
}

export async function countHighlights(userId: string): Promise<number> {
  const col = await collection();
  return col.countDocuments({ user_id: userId });
}

export async function createHighlight(
  userId: string,
  user: PlanUser | null,
  input: { slug: string; quote: string; note?: string }
): Promise<HighlightRow | { error: string; code?: string }> {
  const slug = input.slug.trim().slice(0, 120);
  const quote = input.quote.trim().slice(0, 800);
  const note = (input.note || "").trim().slice(0, 1000);
  if (!slug || (!quote && !note)) {
    return { error: "Highlight a passage or add a note." };
  }
  const cap = entitlementsFor(user).highlights;
  if (cap != null) {
    const n = await countHighlights(userId);
    if (n >= cap) {
      return {
        error: `Free accounts can keep ${cap} highlights. Upgrade to Pro for a full commonplace book.`,
        code: "upgrade_required",
      };
    }
  }
  const col = await collection();
  const doc: Omit<HighlightDoc, "_id"> = {
    user_id: userId,
    article_slug: slug,
    quote,
    note,
    created_at: new Date(),
  };
  const result = await col.insertOne(doc as HighlightDoc);
  return toRow({ ...doc, _id: result.insertedId } as HighlightDoc);
}

export async function deleteHighlight(id: string, userId: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await collection();
  const result = await col.deleteOne({ _id: new ObjectId(id), user_id: userId });
  return result.deletedCount > 0;
}

export async function deleteHighlightsForUser(userId: string): Promise<void> {
  if (!userId) return;
  const col = await collection();
  await col.deleteMany({ user_id: userId });
}
