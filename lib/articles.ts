import { ObjectId, Filter, Sort } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { sanitizeHttpUrl } from "./http-url";
import { PublishGateError, publishBlocker } from "./publish-gate";
import { anchoredSlugRegex, escapeRegex, matchPublishedLabel } from "./name-slug";
import { canonicalSourceId } from "./source-id";
import type { ArticleRow, PaperSourceKind, TranslatedArticle } from "./prompts";
import {
  applyHighlights,
  buildArticleMongoFilter,
  type SearchFilters,
  type SearchSort,
} from "./search";

export interface ArticleDoc {
  _id: ObjectId;
  title: string;
  headline: string;
  why_it_matters: string[];
  plain_explanation: string;
  caveats: string;
  keywords?: string[];
  tags?: string[];
  authors?: string[];
  institutions?: string[];
  licence?: string | null;
  /** Opening of an extracted PDF, used only to refuse republishing that PDF. */
  source_fingerprint?: string | null;
  slug: string;
  source_url: string | null;
  source?: PaperSourceKind | null;
  /** arXiv id or PMID. Unique with `source` when set. */
  source_id?: string | null;
  status: "draft" | "published";
  created_at: Date;
  published_at?: Date | null;
  shared_to?: string[];
  category?: string | null;
  share_approved?: boolean;
}

function toArticleRow(doc: ArticleDoc & { score?: number }): ArticleRow {
  return {
    id: doc._id.toString(),
    title: doc.title,
    headline: doc.headline,
    why_it_matters: doc.why_it_matters || [],
    plain_explanation: doc.plain_explanation || "",
    caveats: doc.caveats || "",
    keywords: doc.keywords || [],
    tags: doc.tags || [],
    authors: doc.authors || [],
    institutions: doc.institutions || [],
    licence: doc.licence || null,
    slug: doc.slug,
    source_url: sanitizeHttpUrl(doc.source_url),
    source: doc.source ?? null,
    status: doc.status,
    created_at: doc.created_at?.toISOString(),
    published_at: doc.published_at ? doc.published_at.toISOString() : null,
    shared_to: doc.shared_to || [],
    category: doc.category ?? null,
    score: doc.score,
    share_approved: Boolean(doc.share_approved),
  };
}

/** Fields needed for homepage cards, search results, RSS, sitemap (not full body). */
const LIST_PROJECTION = {
  title: 1,
  headline: 1,
  slug: 1,
  source_url: 1,
  source: 1,
  status: 1,
  category: 1,
  authors: 1,
  tags: 1,
  keywords: 1,
  institutions: 1,
  published_at: 1,
  created_at: 1,
  shared_to: 1,
  share_approved: 1,
} as const;

async function articlesCollection() {
  const db = await getDb();
  return db.collection<ArticleDoc>("articles");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export async function getPublishedArticles(
  page: number,
  pageSize: number,
  options: SearchFilters = {}
): Promise<{ articles: ArticleRow[]; total: number }> {
  const col = await articlesCollection();
  const safePage = Math.min(500, Math.max(1, page || 1));
  const safeSize = Math.min(50, Math.max(1, pageSize || 8));
  const skip = (safePage - 1) * safeSize;
  const filter = buildArticleMongoFilter(
    { status: "published" },
    options
  ) as Filter<ArticleDoc>;

  const hasText = Boolean(options.query?.trim());
  const usesTextOperator = Boolean(
    (filter as Filter<Record<string, unknown>> & { $text?: unknown }).$text
  );
  const sortMode: SearchSort =
    options.sort || (hasText && usesTextOperator ? "relevance" : "newest");
  const useTextScore = sortMode === "relevance" && usesTextOperator;

  let sort: Sort;
  if (useTextScore) {
    sort = { score: { $meta: "textScore" } };
  } else if (sortMode === "oldest") {
    sort = { published_at: 1, created_at: 1 };
  } else {
    sort = { published_at: -1, created_at: -1 };
  }

  const projection = useTextScore
    ? { ...LIST_PROJECTION, score: { $meta: "textScore" as const } }
    : { ...LIST_PROJECTION };

  async function runFind() {
    return Promise.all([
      col
        .find(filter, { projection })
        .sort(sort)
        .skip(skip)
        .limit(safeSize)
        .toArray() as Promise<(ArticleDoc & { score?: number })[]>,
      col.countDocuments(filter),
    ]);
  }

  let docs: (ArticleDoc & { score?: number })[];
  let total: number;
  try {
    [docs, total] = await runFind();
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    // 40218: asked for textScore on a query that is not a $text search
    if (code !== 40218 || !useTextScore) throw err;
    const fallback = col
      .find(filter, { projection: LIST_PROJECTION })
      .sort({ published_at: -1, created_at: -1 })
      .skip(skip)
      .limit(safeSize)
      .toArray() as Promise<(ArticleDoc & { score?: number })[]>;
    [docs, total] = await Promise.all([fallback, col.countDocuments(filter)]);
  }

  const articles = docs
    .map(toArticleRow)
    .map((a) => applyHighlights(a, options.query));

  return { articles, total };
}

export async function suggestPublishedArticles(
  query: string,
  limit = 6
): Promise<ArticleRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { articles } = await getPublishedArticles(1, limit, {
    query: q,
    sort: "newest",
  });
  return articles;
}

export async function getPublishedArticlesBySlugs(
  slugs: string[],
  limit = 50
): Promise<ArticleRow[]> {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(0, limit);
  if (unique.length === 0) return [];
  const col = await articlesCollection();
  const docs = await col
    .find(
      { status: "published", slug: { $in: unique } },
      { projection: LIST_PROJECTION }
    )
    .toArray();
  const bySlug = new Map(docs.map((d) => [d.slug, toArticleRow(d)]));
  return unique.flatMap((slug) => {
    const row = bySlug.get(slug);
    return row ? [row] : [];
  });
}

export async function getAllPublishedArticles(limit = 50): Promise<ArticleRow[]> {
  const col = await articlesCollection();
  const docs = await col
    .find(
      { status: "published" },
      { projection: LIST_PROJECTION }
    )
    .sort({ published_at: -1, created_at: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toArticleRow);
}

export async function getRelatedPublishedArticles(
  slug: string,
  category: string | null | undefined,
  limit = 3,
  tags: string[] = []
): Promise<ArticleRow[]> {
  const col = await articlesCollection();
  const or: Filter<ArticleDoc>[] = [];
  if (category) or.push({ category });
  const cleanTags = tags.map((t) => t.trim()).filter(Boolean).slice(0, 8);
  if (cleanTags.length) {
    or.push({ tags: { $in: cleanTags } });
    or.push({ keywords: { $in: cleanTags } });
  }
  const filter: Filter<ArticleDoc> = {
    status: "published",
    slug: { $ne: slug },
    ...(or.length ? { $or: or } : {}),
  };
  const docs = await col
    .find(filter, { projection: LIST_PROJECTION })
    .sort({ published_at: -1, created_at: -1 })
    .limit(limit)
    .toArray();
  if (docs.length >= limit) return docs.map(toArticleRow);

  const extra = await col
    .find(
      { status: "published", slug: { $nin: [slug, ...docs.map((d) => d.slug)] } },
      { projection: LIST_PROJECTION }
    )
    .sort({ published_at: -1, created_at: -1 })
    .limit(limit - docs.length)
    .toArray();
  return [...docs, ...extra].map(toArticleRow);
}

export async function getForYouArticles(
  topics: string[],
  limit = 6
): Promise<ArticleRow[]> {
  const cleaned = [...new Set(topics.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  if (!cleaned.length) return [];
  const col = await articlesCollection();
  const or: Filter<ArticleDoc>[] = cleaned.flatMap((t) => {
    const rx = new RegExp(escapeRegex(t), "i");
    return [
      { tags: rx },
      { keywords: rx },
      { title: rx },
      { category: rx },
    ];
  });
  const docs = await col
    .find({ status: "published", $or: or }, { projection: LIST_PROJECTION })
    .sort({ published_at: -1, created_at: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toArticleRow);
}

export async function getPublishedTagCounts(
  limit = 40
): Promise<{ tag: string; count: number }[]> {
  const col = await articlesCollection();
  const rows = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: "published" } },
      {
        $project: {
          labels: {
            $setUnion: [{ $ifNull: ["$tags", []] }, { $ifNull: ["$keywords", []] }],
          },
        },
      },
      { $unwind: "$labels" },
      { $match: { labels: { $type: "string" } } },
      { $group: { _id: "$labels", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();
  return rows.map((r) => ({ tag: r._id, count: r.count }));
}

export async function getPublishedAuthorCounts(
  limit = 40
): Promise<{ name: string; count: number }[]> {
  const col = await articlesCollection();
  const rows = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: "published", authors: { $exists: true, $ne: [] } } },
      { $unwind: "$authors" },
      { $match: { authors: { $type: "string", $ne: "" } } },
      { $group: { _id: "$authors", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();
  return rows.map((r) => ({ name: r._id, count: r.count }));
}

export async function resolveAuthorNameFromSlug(slug: string): Promise<string | null> {
  const rx = anchoredSlugRegex(slug);
  if (!rx) return null;
  const col = await articlesCollection();
  const doc = await col.findOne(
    { status: "published", authors: rx },
    { projection: { authors: 1 } }
  );
  if (!doc) return null;
  return matchPublishedLabel(slug, doc.authors || []);
}

/** Published tag or keyword for this slug. Unknown slugs stay null (404). */
export async function resolvePublishedTag(slug: string): Promise<string | null> {
  const rx = anchoredSlugRegex(slug);
  if (!rx) return null;
  const col = await articlesCollection();
  const doc = await col.findOne(
    { status: "published", $or: [{ tags: rx }, { keywords: rx }] },
    { projection: { tags: 1, keywords: 1 } }
  );
  if (!doc) return null;
  return matchPublishedLabel(slug, [...(doc.tags || []), ...(doc.keywords || [])]);
}

export async function getTrendingArticles(limit = 5): Promise<ArticleRow[]> {
  // Proxy for trending: most social shares, then newest
  const col = await articlesCollection();
  const docs = await col
    .aggregate<ArticleDoc>([
      { $match: { status: "published" } },
      {
        $addFields: {
          shareCount: { $size: { $ifNull: ["$shared_to", []] } },
        },
      },
      { $sort: { shareCount: -1, published_at: -1, created_at: -1 } },
      { $limit: limit },
      { $project: LIST_PROJECTION },
    ])
    .toArray();
  return docs.map(toArticleRow);
}

export async function getEditorPicks(limit = 3): Promise<ArticleRow[]> {
  const col = await articlesCollection();
  const docs = await col
    .find({ status: "published", share_approved: true }, { projection: LIST_PROJECTION })
    .sort({ published_at: -1 })
    .limit(limit)
    .toArray();
  if (docs.length) return docs.map(toArticleRow);
  return getAllPublishedArticles(limit);
}

export async function getPublishedCategoryCounts(): Promise<Record<string, number>> {
  const col = await articlesCollection();
  const { normalizeCategory } = await import("./arxivCategories");
  const results = await col
    .aggregate<{ _id: string | null; count: number }>([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();

  const counts: Record<string, number> = {};
  for (const r of results) {
    const raw = (r._id || "").trim();
    if (!raw) {
      counts.other = (counts.other || 0) + r.count;
      continue;
    }
    // Collapse arXiv subcodes (q-bio.NC → q-bio) so pills match filters
    const key = normalizeCategory(raw) || raw;
    counts[key] = (counts[key] || 0) + r.count;
  }
  return counts;
}

export async function getArticleBySlug(
  slug: string,
  publishedOnly = true
): Promise<ArticleRow | null> {
  const col = await articlesCollection();
  const filter: Filter<ArticleDoc> = { slug };
  if (publishedOnly) filter.status = "published";
  const doc = await col.findOne(filter);
  return doc ? toArticleRow(doc) : null;
}

/** Cheap existence check (no article body) for the 404 probe. */
export async function publishedSlugExists(slug: string): Promise<boolean> {
  const col = await articlesCollection();
  const doc = await col.findOne({ slug, status: "published" }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function getArticleById(id: string): Promise<ArticleRow | null> {
  if (!isValidObjectId(id)) return null;
  const col = await articlesCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? toArticleRow(doc) : null;
}

export async function getAdminArticles(
  page: number,
  pageSize: number,
  status?: "draft" | "published",
  options: SearchFilters = {}
): Promise<{ articles: ArticleRow[]; total: number }> {
  const col = await articlesCollection();
  const base: Filter<ArticleDoc> = status ? { status } : {};
  const filter = buildArticleMongoFilter(
    base as Filter<Record<string, unknown>>,
    options
  ) as Filter<ArticleDoc>;
  const safePage = Math.min(500, Math.max(1, page || 1));
  const safeSize = Math.min(50, Math.max(1, pageSize || 15));
  const skip = (safePage - 1) * safeSize;
  const usesText = Boolean(
    (filter as Filter<Record<string, unknown>> & { $text?: unknown }).$text
  );

  const cursor = col.find(filter, {
    projection: usesText
      ? { ...LIST_PROJECTION, score: { $meta: "textScore" as const } }
      : LIST_PROJECTION,
  });
  if (usesText) cursor.sort({ score: { $meta: "textScore" } });
  else cursor.sort({ created_at: -1 });

  try {
    const [docs, total] = await Promise.all([
      cursor.skip(skip).limit(safeSize).toArray() as Promise<
        (ArticleDoc & { score?: number })[]
      >,
      col.countDocuments(filter),
    ]);
    return { articles: docs.map(toArticleRow), total };
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    if (code !== 40218) throw err;
    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(safeSize)
        .toArray() as Promise<(ArticleDoc & { score?: number })[]>,
      col.countDocuments(filter),
    ]);
    return { articles: docs.map(toArticleRow), total };
  }
}

export async function getAdminCategoryCounts(): Promise<Record<string, number>> {
  const col = await articlesCollection();
  const results = await col
    .aggregate<{ _id: string | null; count: number }>([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();

  const { normalizeCategory } = await import("./arxivCategories");
  const counts: Record<string, number> = {};
  for (const r of results) {
    const raw = (r._id || "").trim();
    if (!raw) {
      counts.other = (counts.other || 0) + r.count;
      continue;
    }
    const key = normalizeCategory(raw) || raw;
    counts[key] = (counts[key] || 0) + r.count;
  }
  return counts;
}

export async function insertDraftArticle(
  article: TranslatedArticle,
  sourceUrl: string | null,
  fallbackTitle: string,
  category: string | null = null,
  meta: {
    source?: PaperSourceKind | null;
    authors?: string[];
    institutions?: string[];
    licence?: string | null;
    sourceFingerprint?: string | null;
    sourceId?: string | null;
  } = {}
): Promise<ArticleRow> {
  const col = await articlesCollection();
  const baseSlug = slugify(article.title || fallbackTitle);

  const cleanSource = sanitizeHttpUrl(sourceUrl);
  const source =
    meta.source ??
    (sourceUrl?.includes("pubmed") ? "pubmed" : sourceUrl?.includes("arxiv") ? "arxiv" : "manual");
  const sourceId = canonicalSourceId({
    externalId: meta.sourceId,
    sourceUrl: cleanSource,
  });
  const doc: Omit<ArticleDoc, "_id"> = {
    title: article.title,
    headline: article.headline,
    why_it_matters: article.why_it_matters,
    plain_explanation: article.plain_explanation,
    caveats: article.caveats,
    keywords: article.keywords || [],
    tags: article.tags || [],
    authors: meta.authors || [],
    institutions: meta.institutions || [],
    licence: meta.licence?.trim().slice(0, 300) || null,
    source_fingerprint: meta.sourceFingerprint?.trim().toLowerCase().slice(0, 180) || null,
    slug: baseSlug,
    source_url: cleanSource,
    source,
    status: "draft",
    created_at: new Date(),
    published_at: null,
    category,
    share_approved: false,
  };
  if (!cleanSource) {
    delete (doc as { source_url?: string | null }).source_url;
  }
  if (sourceId) doc.source_id = sourceId;

  try {
    const result = await col.insertOne(doc as ArticleDoc);
    return toArticleRow({ ...doc, _id: result.insertedId } as ArticleDoc);
  } catch (err: unknown) {
    if (!isDuplicateKey(err)) throw err;

    const existing = await existingDraftFromDuplicate(col, err, doc);
    if (existing) return existing;
    if (!duplicateKeyIsSlug(err)) throw err;

    const retrySlug = `${baseSlug}-${Date.now().toString(36)}`;
    const retryDoc = { ...doc, slug: retrySlug };
    try {
      const result = await col.insertOne(retryDoc as ArticleDoc);
      return toArticleRow({ ...retryDoc, _id: result.insertedId } as ArticleDoc);
    } catch (retryErr: unknown) {
      if (!isDuplicateKey(retryErr)) throw retryErr;
      const again = await existingDraftFromDuplicate(col, retryErr, retryDoc);
      if (again) return again;
      throw retryErr;
    }
  }
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

function duplicateKeyValue(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== "object" || !("keyValue" in err)) return null;
  const keyValue = (err as { keyValue?: unknown }).keyValue;
  if (!keyValue || typeof keyValue !== "object") return null;
  return keyValue as Record<string, unknown>;
}

function duplicateKeyIsSlug(err: unknown): boolean {
  const keyValue = duplicateKeyValue(err);
  if (!keyValue) return false;
  return "slug" in keyValue && !("source_id" in keyValue) && !("source_url" in keyValue);
}

async function existingDraftFromDuplicate(
  col: Awaited<ReturnType<typeof articlesCollection>>,
  err: unknown,
  doc: { source_url?: string | null; source?: ArticleDoc["source"]; source_id?: string | null }
): Promise<ArticleRow | null> {
  const keyValue = duplicateKeyValue(err);
  if (keyValue && typeof keyValue.source_id === "string") {
    const rawSource = typeof keyValue.source === "string" ? keyValue.source : doc.source;
    const source =
      rawSource === "arxiv" ||
      rawSource === "pubmed" ||
      rawSource === "manual" ||
      rawSource === "submission"
        ? rawSource
        : undefined;
    const found = await col.findOne({
      source_id: keyValue.source_id,
      ...(source ? { source } : {}),
    });
    if (found) return toArticleRow(found);
  }
  if (keyValue && typeof keyValue.source_url === "string") {
    const found = await col.findOne({ source_url: keyValue.source_url });
    if (found) return toArticleRow(found);
  }
  if (doc.source_id && doc.source) {
    const found = await col.findOne({ source: doc.source, source_id: doc.source_id });
    if (found) return toArticleRow(found);
  }
  if (doc.source_url) {
    const found = await col.findOne({ source_url: doc.source_url });
    return found ? toArticleRow(found) : null;
  }
  return null;
}

export async function updateArticle(
  id: string,
  updates: Record<string, unknown>
): Promise<ArticleRow | null> {
  if (!isValidObjectId(id)) return null;
  const col = await articlesCollection();

  const safeUpdates: Record<string, unknown> = {};

  if (typeof updates.title === "string") safeUpdates.title = updates.title.trim().slice(0, 300);
  if (typeof updates.headline === "string") safeUpdates.headline = updates.headline.trim().slice(0, 500);
  if (typeof updates.plain_explanation === "string") {
    safeUpdates.plain_explanation = updates.plain_explanation.slice(0, 50000);
  }
  if (typeof updates.caveats === "string") {
    safeUpdates.caveats = updates.caveats.slice(0, 20000);
  }
  if (typeof updates.slug === "string") {
    const slug = updates.slug
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-");
    if (slug) safeUpdates.slug = slug.slice(0, 80);
  }
  if (updates.source_url === null) {
    safeUpdates.source_url = null;
  } else if (typeof updates.source_url === "string") {
    const clean = sanitizeHttpUrl(updates.source_url);
    // Invalid strings must not wipe an existing source_url (javascript:, credentials).
    if (clean) safeUpdates.source_url = clean;
  }
  if (updates.category === null) {
    safeUpdates.category = null;
  } else if (typeof updates.category === "string") {
    safeUpdates.category = updates.category.trim() || null;
  }
  if (updates.status === "draft" || updates.status === "published") {
    safeUpdates.status = updates.status;
  }
  if (typeof updates.share_approved === "boolean") {
    safeUpdates.share_approved = updates.share_approved;
  }
  if (updates.source === "arxiv" || updates.source === "pubmed" || updates.source === "manual" || updates.source === "submission") {
    safeUpdates.source = updates.source;
  }
  if (typeof updates.licence === "string") {
    safeUpdates.licence = updates.licence.trim().slice(0, 300);
  }

  const authors = stringArray(updates.authors);
  if (authors) safeUpdates.authors = authors;
  const institutions = stringArray(updates.institutions);
  if (institutions) safeUpdates.institutions = institutions;
  const keywords = stringArray(updates.keywords);
  if (keywords) safeUpdates.keywords = keywords;
  const tags = stringArray(updates.tags);
  if (tags) safeUpdates.tags = tags;

  if (Array.isArray(updates.why_it_matters)) {
    const points = updates.why_it_matters
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);
    safeUpdates.why_it_matters = points;
  }

  if (Object.keys(safeUpdates).length === 0) return null;

  const existing = await col.findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  const nextStatus =
    safeUpdates.status === "draft" || safeUpdates.status === "published"
      ? safeUpdates.status
      : existing.status;
  const staysOrBecomesPublished = nextStatus === "published";

  if (staysOrBecomesPublished) {
    const nextSource =
      "source_url" in safeUpdates
        ? (safeUpdates.source_url as string | null)
        : existing.source_url;
    const nextCaveats =
      typeof safeUpdates.caveats === "string" ? safeUpdates.caveats : existing.caveats;
    const nextBody =
      typeof safeUpdates.plain_explanation === "string"
        ? safeUpdates.plain_explanation
        : existing.plain_explanation;
    const nextLicence =
      typeof safeUpdates.licence === "string" ? safeUpdates.licence : existing.licence;
    const blocked = publishBlocker({
      sourceUrl: nextSource,
      caveats: nextCaveats,
      licence: nextLicence,
      plainExplanation: nextBody,
      sourceFingerprint: existing.source_fingerprint,
    });
    if (blocked) throw new PublishGateError(blocked);
  }

  if (safeUpdates.status === "published" && existing.status !== "published") {
    safeUpdates.published_at = new Date();
  }

  const unset: Record<string, ""> = {};
  if (safeUpdates.source_url === null) {
    delete safeUpdates.source_url;
    unset.source_url = "";
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(safeUpdates).length) update.$set = safeUpdates;
  if (Object.keys(unset).length) update.$unset = unset;
  if (!Object.keys(update).length) return toArticleRow(existing);

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    update,
    { returnDocument: "after" }
  );

  return result ? toArticleRow(result) : null;
}

export async function deleteArticle(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await articlesCollection();
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function getExistingSourceUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const col = await articlesCollection();
  const docs = await col
    .find({ source_url: { $in: urls } }, { projection: { source_url: 1 } })
    .toArray();
  return new Set(docs.map((d) => d.source_url as string).filter(Boolean));
}

export async function getExistingSourceIds(
  source: PaperSourceKind,
  ids: string[]
): Promise<Set<string>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return new Set();
  const col = await articlesCollection();
  const docs = await col
    .find({ source, source_id: { $in: unique } }, { projection: { source_id: 1 } })
    .toArray();
  return new Set(
    docs
      .map((d) => d.source_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

export async function markShared(id: string, platform: string): Promise<void> {
  if (!isValidObjectId(id)) return;
  const col = await articlesCollection();
  await col.updateOne({ _id: new ObjectId(id) }, { $addToSet: { shared_to: platform } });
}

export async function setShareApproved(id: string, approved: boolean): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const col = await articlesCollection();
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { share_approved: approved } }
  );
  return result.matchedCount > 0;
}
