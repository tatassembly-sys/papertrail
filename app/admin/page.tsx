import Link from "next/link";
import { getAdminArticles, getAdminCategoryCounts } from "@/lib/articles";
import { getSubmissions } from "@/lib/submissions";
import { ARXIV_CATEGORY_CODES, categoryLabel } from "@/lib/arxivCategories";
import { isEmailConfigured } from "@/lib/mail";
import { probeOpenRouterKey } from "@/lib/openrouter-health";
import PublishMixButton from "@/components/PublishMixButton";

export const dynamic = "force-dynamic"; // always show latest drafts, never cache

const PAGE_SIZE = 15;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string; q?: string; category?: string }>;
}

function buildHref(params: {
  page?: number;
  status?: string;
  q?: string;
  category?: string;
}): string {
  const usp = new URLSearchParams();
  if (params.status) usp.set("status", params.status);
  if (params.q) usp.set("q", params.q);
  if (params.category) usp.set("category", params.category);
  if (params.page && params.page > 1) usp.set("page", String(params.page));
  const qs = usp.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

export default async function AdminPage({ searchParams }: PageProps) {
  const { page: pageParam, status, q, category } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const statusFilter = status === "draft" || status === "published" ? status : undefined;
  const query = q?.trim() || "";
  const activeCategory = category?.trim() || "";

  let articles: Awaited<ReturnType<typeof getAdminArticles>>["articles"] = [];
  let total = 0;
  let error: string | null = null;
  let pendingSubmissions = 0;
  let categoryCounts: Record<string, number> = {};
  let openrouterOk = true;
  let openrouterMessage = "";
  const emailConfigured = isEmailConfigured();

  try {
    const [result, counts] = await Promise.all([
      getAdminArticles(page, PAGE_SIZE, statusFilter, { query, category: activeCategory }),
      getAdminCategoryCounts(),
    ]);
    articles = result.articles;
    total = result.total;
    categoryCounts = counts;
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn't load articles.";
  }

  try {
    const openrouter = await probeOpenRouterKey();
    openrouterOk = openrouter.ok;
    openrouterMessage = openrouter.message;
  } catch {
    openrouterOk = false;
    openrouterMessage = "Could not reach OpenRouter to check the API key.";
  }

  try {
    pendingSubmissions = (await getSubmissions("pending")).length;
  } catch {
    // non-critical — dashboard still works without the count
  }

  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1;
  const blockers = [
    !openrouterOk
      ? openrouterMessage ||
        "OpenRouter rejected the API key. Update OPENROUTER_API_KEY on Railway."
      : null,
    !emailConfigured
      ? "Email is log-mode only. Set RESEND_API_KEY and NEWSLETTER_FROM for real delivery."
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div>
      {blockers.length > 0 && (
        <div className="mb-6 rounded-sm border border-redpen/40 bg-redpen-soft p-4 text-sm text-ink">
          <p className="font-mono text-xs uppercase tracking-widest text-redpen">
            Ops blockers
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Admin Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/submissions" className="pt-btn-ghost relative">
            Suggestions
            {pendingSubmissions > 0 && (
              <span className="ml-2 rounded-full bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper">
                {pendingSubmissions}
              </span>
            )}
          </Link>
          <PublishMixButton />
          <Link href="/admin/manual-input" className="pt-btn">
            + Process a paper
          </Link>
        </div>
      </div>

      <form action="/admin" method="GET" className="mb-4 flex flex-wrap gap-2">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search your articles…"
          className="pt-input sm:w-72"
        />
        <button type="submit" className="pt-btn-ghost">
          Search
        </button>
      </form>

      <div className="mb-3 flex gap-4 text-sm">
        <Link
          href={buildHref({ q: query, category: activeCategory })}
          className={!statusFilter ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}
        >
          All
        </Link>
        <Link
          href={buildHref({ q: query, category: activeCategory, status: "draft" })}
          className={
            statusFilter === "draft"
              ? "font-semibold text-ink"
              : "text-ink-soft hover:text-ink"
          }
        >
          Drafts
        </Link>
        <Link
          href={buildHref({ q: query, category: activeCategory, status: "published" })}
          className={
            statusFilter === "published"
              ? "font-semibold text-ink"
              : "text-ink-soft hover:text-ink"
          }
        >
          Published
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={buildHref({ q: query, status: statusFilter })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !activeCategory
              ? "border-ink bg-ink text-paper"
              : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink"
          }`}
        >
          All categories
        </Link>
        {ARXIV_CATEGORY_CODES.map((code) => {
          const count = categoryCounts[code] || 0;
          if (count === 0) return null;
          return (
            <Link
              key={code}
              href={buildHref({ q: query, status: statusFilter, category: code })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeCategory === code
                  ? "border-ink bg-ink text-paper"
                  : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {categoryLabel(code)} ({count})
            </Link>
          );
        })}
      </div>

      {error && <p className="pt-alert-error">Couldn&apos;t load articles: {error}</p>}

      {!error && articles.length === 0 && (
        <p className="text-ink-soft">
          {query || activeCategory ? "No articles match that search." : "Nothing here yet."}
        </p>
      )}

      {!error && articles.length > 0 && (
        <div className="flex flex-col divide-y divide-rule rounded-sm border border-rule bg-surface">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/admin/${article.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{article.title}</p>
                <p className="truncate text-sm text-ink-soft">
                  {article.source_url || "Pasted text (no source URL)"}
                  {article.category && ` · ${categoryLabel(article.category)}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  article.status === "published"
                    ? "bg-success/15 text-success"
                    : "bg-redpen-soft text-ink"
                }`}
              >
                {article.status}
              </span>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={buildHref({
                q: query,
                status: statusFilter,
                category: activeCategory,
                page: page - 1,
              })}
              className="text-ink-soft hover:text-ink"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-stamp">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({
                q: query,
                status: statusFilter,
                category: activeCategory,
                page: page + 1,
              })}
              className="text-ink-soft hover:text-ink"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
