import Link from "next/link";
import {
  getPublishedArticles,
  getPublishedArticlesBySlugs,
  getPublishedCategoryCounts,
} from "@/lib/articles";
import { categoryLabel } from "@/lib/arxivCategories";
import ArticleCard from "@/components/ArticleCard";
import SearchBar from "@/components/SearchBar";
import ActiveFilters from "@/components/ActiveFilters";
import { getLastPublishMix } from "@/lib/publish-mix";
import {
  buildSearchHref,
  hasActiveFilters,
  parseSearchParams,
} from "@/lib/search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  // Pills only control category; ignore empty/whitespace
  const activeCategory = filters.category?.trim() || "";
  const query = filters.query?.trim() || "";
  const page = Math.min(100, Math.max(1, parseInt(String(sp.page || "1"), 10) || 1));

  const listFilters = {
    ...filters,
    category: activeCategory || undefined,
    query: query || undefined,
  };

  let articles: Awaited<ReturnType<typeof getPublishedArticles>>["articles"] = [];
  let total = 0;
  let error: string | null = null;
  let categoryCounts: Record<string, number> = {};

  const [listOutcome, countsOutcome, mixOutcome] = await Promise.allSettled([
    getPublishedArticles(page, PAGE_SIZE, listFilters),
    getPublishedCategoryCounts(),
    getLastPublishMix(),
  ]);

  if (listOutcome.status === "fulfilled") {
    articles = listOutcome.value.articles;
    total = listOutcome.value.total;
  } else {
    console.error("Failed to load articles:", listOutcome.reason);
    error = "Couldn't load articles right now. Please try again shortly.";
  }

  if (countsOutcome.status === "fulfilled") {
    categoryCounts = countsOutcome.value;
  } else {
    console.error("Failed to load category counts:", countsOutcome.reason);
  }

  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1;
  const isFiltered = hasActiveFilters(listFilters);

  let mixArticles: Awaited<ReturnType<typeof getPublishedArticlesBySlugs>> = [];
  let mixDate: string | null = null;
  if (mixOutcome.status === "fulfilled" && mixOutcome.value?.items.length) {
    mixDate = mixOutcome.value.dateKey || null;
    try {
      mixArticles = await getPublishedArticlesBySlugs(
        mixOutcome.value.items.map((item) => String(item.slug || ""))
      );
    } catch (err) {
      console.error("Failed to load daily mix articles:", err);
    }
  }

  // Show every category that actually has published papers (not a fixed list).
  // Sort by count descending so the fullest categories come first.
  const categoryPills = Object.entries(categoryCounts)
    .filter(([code, count]) => code && code !== "other" && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const otherCount = categoryCounts["other"] || categoryCounts[""] || 0;

  return (
    <div>
      <section className="mb-8 max-w-2xl sm:mb-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
          Field notes from research
        </p>
        <h1 className="font-display text-3xl font-medium leading-[1.15] tracking-tight text-ink sm:text-5xl">
          Dense papers, <span className="redpen-mark">translated.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
          Every entry starts as a real paper. We strip the jargon, keep the
          accuracy, and flag exactly what the study can&apos;t claim.
        </p>
      </section>

      <SearchBar
        initialQuery={query}
        preserve={{
          category: activeCategory || undefined,
          author: filters.author || undefined,
          institution: filters.institution || undefined,
          tag: filters.tag || undefined,
          source: filters.source || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          sort: filters.sort && filters.sort !== "newest" ? filters.sort : undefined,
        }}
      />

      <ActiveFilters filters={listFilters} />

      <div className="mb-8 flex flex-wrap gap-2 sm:mb-10" role="navigation" aria-label="Categories">
        <Link
          href={buildSearchHref("/", {
            ...listFilters,
            category: undefined,
            page: 1,
          })}
          className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
            !activeCategory
              ? "border-ink bg-ink text-paper"
              : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink"
          }`}
        >
          All
          {total > 0 && !activeCategory ? (
            <span className="ml-1 opacity-70">({total})</span>
          ) : null}
        </Link>

        {categoryPills.map(([code, count]) => {
          const selected = activeCategory === code;
          return (
            <Link
              key={code}
              href={buildSearchHref("/", {
                ...listFilters,
                category: code,
                page: 1,
              })}
              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
                selected
                  ? "border-ink bg-ink text-paper"
                  : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {categoryLabel(code)}
              <span className={`ml-1 ${selected ? "opacity-70" : "opacity-60"}`}>
                ({count})
              </span>
            </Link>
          );
        })}

        {otherCount > 0 && (
          <Link
            href={buildSearchHref("/", {
              ...listFilters,
              category: "other",
              page: 1,
            })}
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
              activeCategory === "other"
                ? "border-ink bg-ink text-paper"
                : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            Other ({otherCount})
          </Link>
        )}
      </div>

      {categoryPills.length <= 1 && !error && articles.length > 0 && (
        <p className="mb-4 text-sm text-ink-soft">
          Type a field in search (tech, space, health, math) to jump to matching
          papers. New fields appear here as those drafts are published.
        </p>
      )}

      {!isFiltered && page === 1 && mixArticles.length > 0 && (
        <section className="mb-8 sm:mb-10" aria-labelledby="todays-mix">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="todays-mix"
              className="font-mono text-xs uppercase tracking-widest text-stamp"
            >
              Today&apos;s mix{mixDate ? ` · ${mixDate}` : ""}
            </h2>
            <p className="text-xs text-ink-soft">
              One paper per field, so search keeps growing.
            </p>
          </div>
          <ul className="divide-y divide-rule rounded-sm border border-rule bg-surface">
            {mixArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/posts/${article.slug}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper"
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-stamp">
                    {categoryLabel(article.category)}
                  </span>
                  <span className="text-sm font-medium text-ink">{article.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="font-mono text-sm text-redpen">{error}</p>}

      {!error && articles.length === 0 && (
        <div className="rounded-sm border border-dashed border-rule py-16 text-center">
          <p className="text-sm text-ink-soft">
            {isFiltered
              ? "No entries match that search or category."
              : page > 1
                ? "No more entries."
                : "No entries filed yet. Check back soon."}
          </p>
          {isFiltered && (
            <Link href="/" className="mt-4 inline-block font-mono text-xs uppercase text-redpen">
              Clear filters →
            </Link>
          )}
        </div>
      )}

      {!error && articles.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {total} paper{total === 1 ? "" : "s"}
              {query ? ` matching “${query}”` : ""}
              {activeCategory ? ` in ${categoryLabel(activeCategory)}` : ""}
            </p>
            {query ? (
              <nav className="flex gap-3 font-mono text-[11px] uppercase tracking-wide text-stamp" aria-label="Sort">
                {(
                  [
                    ["relevance", "Relevance"],
                    ["newest", "Newest"],
                    ["oldest", "Oldest"],
                  ] as const
                ).map(([value, label]) => {
                  const current = listFilters.sort || "relevance";
                  const active = current === value;
                  return (
                    <Link
                      key={value}
                      href={buildSearchHref("/", { ...listFilters, sort: value, page: 1 })}
                      className={active ? "text-ink" : "hover:text-ink"}
                      aria-current={active ? "page" : undefined}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-between text-sm"
              aria-label="Pagination"
            >
              {page > 1 ? (
                <Link
                  href={buildSearchHref("/", {
                    ...listFilters,
                    page: page - 1,
                  })}
                  className="font-medium text-ink hover:text-redpen"
                >
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="font-mono text-xs uppercase tracking-wide text-stamp">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildSearchHref("/", {
                    ...listFilters,
                    page: page + 1,
                  })}
                  className="font-medium text-ink hover:text-redpen"
                >
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
