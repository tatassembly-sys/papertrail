import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { slugifyLabel } from "./name-slug";
import { entitlementsFor, type PlanUser } from "./entitlements";

export const FREE_COLLECTIONS = 1;
export const FREE_COLLECTION_ITEMS = 20;
export const PRO_COLLECTIONS = 50;
export const PRO_COLLECTION_ITEMS = 200;

export interface CollectionDoc {
  _id: ObjectId;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  slugs: string[];
  public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  slugs: string[];
  public: boolean;
  created_at: string;
  updated_at: string;
}

function toRow(doc: CollectionDoc): CollectionRow {
  return {
    id: doc._id.toString(),
    user_id: doc.user_id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description || "",
    slugs: doc.slugs || [],
    public: Boolean(doc.public),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

async function collection() {
  const db = await getDb();
  return db.collection<CollectionDoc>("collections");
}

function caps(user: PlanUser | null) {
  const pro = entitlementsFor(user).collections == null;
  return {
    pro,
    maxLists: pro ? PRO_COLLECTIONS : FREE_COLLECTIONS,
    maxItems: pro ? PRO_COLLECTION_ITEMS : FREE_COLLECTION_ITEMS,
  };
}

export async function listCollections(userId: string): Promise<CollectionRow[]> {
  const col = await collection();
  const docs = await col.find({ user_id: userId }).sort({ updated_at: -1 }).limit(60).toArray();
  return docs.map(toRow);
}

export async function getCollection(id: string): Promise<CollectionRow | null> {
  if (!isValidObjectId(id)) return null;
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? toRow(doc) : null;
}

export async function createCollection(
  userId: string,
  user: PlanUser | null,
  input: { name: string; description?: string; public?: boolean }
): Promise<CollectionRow | { error: string; code?: string }> {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Name required." };
  const existing = await listCollections(userId);
  const { maxLists, pro } = caps(user);
  if (existing.length >= maxLists) {
    if (pro) {
      return { error: `You can keep up to ${maxLists} reading lists.` };
    }
    return {
      error: `Free accounts can keep ${maxLists} reading list. Upgrade to Pro for more.`,
      code: "upgrade_required",
    };
  }
  const col = await collection();
  const now = new Date();
  const doc: Omit<CollectionDoc, "_id"> = {
    user_id: userId,
    name,
    slug: slugifyLabel(name),
    description: (input.description || "").trim().slice(0, 280),
    slugs: [],
    public: Boolean(input.public),
    created_at: now,
    updated_at: now,
  };
  const result = await col.insertOne(doc as CollectionDoc);
  return toRow({ ...doc, _id: result.insertedId } as CollectionDoc);
}

export async function updateCollection(
  id: string,
  userId: string,
  user: PlanUser | null,
  patch: {
    name?: string;
    description?: string;
    public?: boolean;
    addSlug?: string;
    removeSlug?: string;
  }
): Promise<CollectionRow | { error: string; code?: string }> {
  const current = await getCollection(id);
  if (!current || current.user_id !== userId) return { error: "Not found." };
  const { maxItems, pro } = caps(user);
  const $set: Record<string, unknown> = { updated_at: new Date() };
  if (typeof patch.name === "string") {
    const name = patch.name.trim().slice(0, 80);
    if (name) {
      $set.name = name;
      $set.slug = slugifyLabel(name);
    }
  }
  if (typeof patch.description === "string") {
    $set.description = patch.description.trim().slice(0, 280);
  }
  if (typeof patch.public === "boolean") $set.public = patch.public;

  let slugs = [...current.slugs];
  if (patch.addSlug) {
    const slug = patch.addSlug.trim().slice(0, 120);
    if (slug && !slugs.includes(slug)) {
      if (slugs.length >= maxItems) {
        if (pro) {
          return { error: `This list is full (${maxItems} papers).` };
        }
        return {
          error: `This list is full (${maxItems}). Upgrade to Pro for larger lists.`,
          code: "upgrade_required",
        };
      }
      slugs.push(slug);
    }
  }
  if (patch.removeSlug) {
    slugs = slugs.filter((s) => s !== patch.removeSlug);
  }
  $set.slugs = slugs;

  const col = await collection();
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), user_id: userId },
    { $set },
    { returnDocument: "after" }
  );
  return result ? toRow(result) : { error: "Not found." };
}

export async function deleteCollection(id: string, userId: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await collection();
  const result = await col.deleteOne({ _id: new ObjectId(id), user_id: userId });
  return result.deletedCount > 0;
}

export async function deleteCollectionsForUser(userId: string): Promise<void> {
  if (!userId) return;
  const col = await collection();
  await col.deleteMany({ user_id: userId });
}
