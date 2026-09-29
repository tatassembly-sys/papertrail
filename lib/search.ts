import { Filter } from "mongodb";
import type { ArticleRow, PaperSourceKind } from "./prompts";
import { highlightMatches } from "./highlight";
import {
  ARXIV_CATEGORY_LABELS,
  SEARCH_FIELD_ALIASES,
  SEARCH_WORD_ALIASES,
} from "./arxivCategories";

export type SearchSort = "relevance" | "newest" | "oldest";

export interface SearchFilters {
  query?: string;
  category?: string;
  author?: string;
  institution?: string;
  tag?: string;
  source?: PaperSourceKind | "";
  /** ISO date strings or yyyy-mm-dd */
  from?: string;
  to?: string;
  sort?: SearchSort;
}

export function parseSearchParams(
  sp: Record<string, string | string[] | undefined>
): SearchFilters {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const sort = one("sort");
  const source = one("source");
  return {
    query: one("q") || one("query"),
    category: one("category"),
    author: one("author"),
    institution: one("institution"),
    tag: one("tag") || one("tags"),
    source:
      source === "arxiv" || source === "pubmed" || source === "manual" || source === "submission"
        ? source
        : "",
    from: one("from"),
    to: one("to"),
    sort:
      sort === "oldest" || sort === "newest" || sort === "relevance" ? sort : undefined,
  };
}

export function buildSearchHref(
  path: string,
  filters: SearchFilters & { page?: number }
): string {
  const usp = new URLSearchParams();
  if (filters.query) usp.set("q", filters.query);
  if (filters.category) usp.set("category", filters.category);
  if (filters.author) usp.set("author", filters.author);
  if (filters.institution) usp.set("institution", filters.institution);
  if (filters.tag) usp.set("tag", filters.tag);
  if (filters.source) usp.set("source", filters.source);
  if (filters.from) usp.set("from", filters.from);
  if (filters.to) usp.set("to", filters.to);
  if (filters.sort && filters.sort !== "newest") usp.set("sort", filters.sort);
  if (filters.page && filters.page > 1) usp.set("page", String(filters.page));
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return Boolean(
    f.query || f.category || f.author || f.institution || f.tag || f.source || f.from || f.to
  );
}

/** Mongo filter for published article search. */
export function buildArticleMongoFilter(
  base: Filter<Record<string, unknown>>,
  filters: SearchFilters
): Filter<Record<string, unknown>> {
  const filter: Filter<Record<string, unknown>> = { ...base };
  const and: Filter<Record<string, unknown>>[] = [];

  if (filters.category && filters.category !== "other") {
    // Exact category, or arXiv subcodes like q-bio.NC under q-bio
    and.push({
      $or: [
        { category: filters.category },
        { category: { $regex: `^${escapeRegex(filters.category)}\\.` } },
      ],
    });
  } else if (filters.category === "other") {
    and.push({
      $or: [{ category: null }, { category: "" }, { category: { $exists: false } }],
    });
  }
  if (filters.source) filter.source = filters.source;
  if (filters.tag) {
    const tagRx = new RegExp(`^${escapeRegex(filters.tag)}$`, "i");
    and.push({
      $or: [{ tags: tagRx }, { keywords: tagRx }],
    });
  }
  if (filters.author) {
    and.push({ authors: { $regex: escapeRegex(filters.author), $options: "i" } });
  }
  if (filters.institution) {
    and.push({
      institutions: { $regex: escapeRegex(filters.institution), $options: "i" },
    });
  }

  const dateField = "published_at";
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) {
      const d = new Date(filters.from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (filters.to) {
      const d = new Date(filters.to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length) {
      and.push({
        $or: [
          { [dateField]: range },
          // Fallback for older docs without published_at
          { published_at: null, created_at: range },
          { published_at: { $exists: false }, created_at: range },
        ],
      } as Filter<Record<string, unknown>>);
    }
  }

  const query = filters.query?.trim();
  if (query) {
    const expanded = expandSearchQuery(query);
    const alias = isFieldAliasQuery(query);
    if (alias && (expanded.categories.length || expanded.words.length)) {
      // Field nicknames like "tech" are not in the text index. Match
      // category + title/headline words instead of $text (which ANDs terms).
      const or: Filter<Record<string, unknown>>[] = [];
      if (expanded.categories.length) {
        or.push({ category: { $in: expanded.categories } });
        or.push({
          category: {
            $regex: `^(${expanded.categories.map(escapeRegex).join("|")})(\\.|$)`,
          },
        });
      }
      const wordRx = expanded.words.map(escapeRegex).join("|");
      if (wordRx) {
        or.push({ title: { $regex: wordRx, $options: "i" } });
        or.push({ headline: { $regex: wordRx, $options: "i" } });
        or.push({ tags: { $regex: wordRx, $options: "i" } });
        or.push({ keywords: { $regex: wordRx, $options: "i" } });
      }
      if (or.length) and.push({ $or: or });
    } else {
      filter.$text = { $search: query };
    }
  }

  if (and.length) {
    filter.$and = and;
  }

  return filter;
}

export function applyHighlights(article: ArticleRow, query?: string): ArticleRow {
  if (!query?.trim()) return article;
  return {
    ...article,
    highlights: {
      title: highlightMatches(article.title, query),
      headline: highlightMatches(article.headline, query),
    },
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function expandSearchQuery(query: string): {
  categories: string[];
  words: string[];
} {
  const q = query.trim().toLowerCase();
  const categories = new Set<string>();
  const words = new Set<string>([q]);

  const consider = (key: string) => {
    const fields = SEARCH_FIELD_ALIASES[key];
    if (fields) fields.forEach((c) => categories.add(c));
    const extra = SEARCH_WORD_ALIASES[key];
    if (extra) extra.forEach((w) => words.add(w));
  };

  consider(q);
  for (const key of Object.keys(SEARCH_FIELD_ALIASES)) {
    if (key.startsWith(q) || q.startsWith(key)) consider(key);
  }
  for (const [code, label] of Object.entries(ARXIV_CATEGORY_LABELS)) {
    const needle = label.toLowerCase();
    if (needle.includes(q) || q.includes(needle)) {
      categories.add(code);
    }
  }

  return { categories: [...categories], words: [...words] };
}

/** True when the query is a field nickname (tech, space…) rather than a paper title. */
export function isFieldAliasQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (SEARCH_FIELD_ALIASES[q]) return true;
  return Object.keys(SEARCH_FIELD_ALIASES).some(
    (key) => key.startsWith(q) || q.startsWith(key)
  );
}
