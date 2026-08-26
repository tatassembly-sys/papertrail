import Image from "next/image";
import Link from "next/link";
import type { ArticleRow } from "@/lib/prompts";
import { categoryLabel } from "@/lib/arxivCategories";

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export default function ArticleCard({ article }: { article: ArticleRow }) {
  const sourceLabel =
    article.source === "pubmed"
      ? "PubMed"
      : article.source === "manual"
        ? "Manual"
        : article.source === "submission"
          ? "Suggested"
          : "arXiv";

  return (
    <Link
      href={`/posts/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-sm border border-rule bg-surface transition hover:-translate-y-0.5 hover:border-ink hover:shadow-[2px_2px_0_0_rgb(var(--redpen))]"
    >
      <div className="relative aspect-[1.91/1] w-full overflow-hidden border-b border-rule bg-paper">
        <Image
          src={`/posts/${article.slug}/opengraph-image`}
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-stamp">
          <span>{sourceLabel}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(article.published_at || article.created_at)}</span>
          {article.category && (
            <>
              <span aria-hidden>·</span>
              <span>{categoryLabel(article.category)}</span>
            </>
          )}
        </div>

        <h2 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">
          {article.highlights?.title ? (
            <span dangerouslySetInnerHTML={{ __html: article.highlights.title }} />
          ) : (
            article.title
          )}
        </h2>

        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink-soft">
          {article.highlights?.headline ? (
            <span dangerouslySetInnerHTML={{ __html: article.highlights.headline }} />
          ) : (
            article.headline
          )}
        </p>

        {(article.authors?.length || article.tags?.length) && (
          <p className="mt-2 line-clamp-1 font-mono text-[10px] text-stamp">
            {article.authors?.slice(0, 2).join(", ")}
            {article.tags?.length ? ` · ${article.tags.slice(0, 3).join(", ")}` : ""}
          </p>
        )}

        <span className="mt-4 font-mono text-[11px] uppercase tracking-wide text-ink-soft transition group-hover:text-redpen">
          Read more →
        </span>
      </div>
    </Link>
  );
}
