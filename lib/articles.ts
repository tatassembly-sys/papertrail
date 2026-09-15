import { ObjectId, Filter, Sort } from "mongodb";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { sanitizeHttpUrl } from "./http-url";
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
  slug: string;
  source_url: string | null;
  source?: PaperSourceKind | null;
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
  limit = 3
): Promise<ArticleRow[]> {
  const col = await articlesCollection();
  const filter: Filter<ArticleDoc> = {
    status: "published",
    slug: { $ne: slug },
  };
  if (category) filter.category = category;
  const docs = await col
    .find(filter, { projection: LIST_PROJECTION })
    .sort({ published_at: -1, created_at: -1 })
    .limit(limit)
    .toArray();
  if (docs.length >= limit || !category) return docs.map(toArticleRow);

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
    ])
    .toArray();
  return docs.map(toArticleRow);
}

export async function getEditorPicks(limit = 3): Promise<ArticleRow[]> {
  const col = await articlesCollection();
  const docs = await col
    .find({ status: "published", share_approved: true })
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
  } = {}
): Promise<ArticleRow> {
  const col = await articlesCollection();
  const baseSlug = slugify(article.title || fallbackTitle);

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
    slug: baseSlug,
    source_url: sanitizeHttpUrl(sourceUrl),
    source: meta.source ?? (sourceUrl?.includes("pubmed") ? "pubmed" : sourceUrl?.includes("arxiv") ? "arxiv" : "manual"),
    status: "draft",
    created_at: new Date(),
    published_at: null,
    category,
    share_approved: false,
  };

  try {
    const result = await col.insertOne(doc as ArticleDoc);
    return toArticleRow({ ...doc, _id: result.insertedId } as ArticleDoc);
  } catch (err: unknown) {
    const isDuplicateKey =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000;
    if (!isDuplicateKey) throw err;

    const existing = await existingDraftFromDuplicate(col, err, doc.source_url);
    if (existing) return existing;

    const retrySlug = `${baseSlug}-${Date.now().toString(36)}`;
    const retryDoc = { ...doc, slug: retrySlug };
    try {
      const result = await col.insertOne(retryDoc as ArticleDoc);
      return toArticleRow({ ...retryDoc, _id: result.insertedId } as ArticleDoc);
    } catch (retryErr: unknown) {
      const retryDup =
        typeof retryErr === "object" &&
        retryErr !== null &&
        "code" in retryErr &&
        (retryErr as { code: number }).code === 11000;
      if (!retryDup) throw retryErr;
      const again = await existingDraftFromDuplicate(col, retryErr, doc.source_url);
      if (again) return again;
      throw retryErr;
    }
  }
}

async function existingDraftFromDuplicate(
  col: Awaited<ReturnType<typeof articlesCollection>>,
  err: unknown,
  sourceUrl: string | null
): Promise<ArticleRow | null> {
  const keyValue =
    typeof err === "object" && err !== null && "keyValue" in err
      ? (err as { keyValue?: Record<string, unknown> }).keyValue
      : undefined;
  if (keyValue && typeof keyValue.source_url === "string") {
    const found = await col.findOne({ source_url: keyValue.source_url });
    return found ? toArticleRow(found) : null;
  }
  if (sourceUrl) {
    const found = await col.findOne({ source_url: sourceUrl });
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
    safeUpdates.source_url = sanitizeHttpUrl(updates.source_url);
  }
  if (updates.category === null) {
    safeUpdates.category = null;
  } else if (typeof updates.category === "string") {
    safeUpdates.category = updates.category.trim() || null;
  }
  if (updates.status === "draft" || updates.status === "published") {
    safeUpdates.status = updates.status;
    if (updates.status === "published") {
      safeUpdates.published_at = new Date();
    }
  }
  if (typeof updates.share_approved === "boolean") {
    safeUpdates.share_approved = updates.share_approved;
  }
  if (updates.source === "arxiv" || updates.source === "pubmed" || updates.source === "manual" || updates.source === "submission") {
    safeUpdates.source = updates.source;
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

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: safeUpdates },
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
