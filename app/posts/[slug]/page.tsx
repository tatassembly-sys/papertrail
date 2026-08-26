import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getArticleBySlug } from "@/lib/articles";
import { recordReading } from "@/lib/users";
import { getCurrentUserSession } from "@/lib/user-auth";
import ArticleChat from "@/components/ArticleChat";
import SaveActions from "@/components/SaveActions";
import { buildShareLinks } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-url";
import { categoryLabel } from "@/lib/arxivCategories";
import { sanitizeHttpUrl } from "@/lib/http-url";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let article;

  try {
    article = await getArticleBySlug(slug);
  } catch (error) {
    console.error("Failed to load article metadata:", error);
    return { title: "Paper Trail is temporarily unavailable" };
  }

  if (!article) notFound();

  return {
    title: `${article.title} — Paper Trail`,
    description: article.headline,
    openGraph: {
      title: article.title,
      description: article.headline,
      type: "article",
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  let article;

  try {
    article = await getArticleBySlug(slug);
  } catch (error) {
    console.error("Failed to load article:", error);
    return (
      <div className="rounded-sm border border-dashed border-rule p-6 text-ink-soft">
        This article is temporarily unavailable. Please try again shortly.
      </div>
    );
  }

  if (!article) notFound();

  const session = await getCurrentUserSession();
  if (session) {
    void recordReading(session.userId, slug);
  }

  const share = buildShareLinks(article, getSiteUrl());
  const sourceLabel =
    article.source === "pubmed"
      ? "PubMed"
      : article.source === "manual"
        ? "Manual"
        : article.source === "submission"
          ? "Suggested"
          : "arXiv";

  const sourceHref = sanitizeHttpUrl(article.source_url);

  return (
    <article className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-stamp hover:text-redpen sm:mb-8"
      >
        ← All entries
      </Link>

      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-stamp">
        {sourceLabel}
        {article.category ? ` · ${categoryLabel(article.category)}` : ""}
      </p>

      <h1 className="font-display text-2xl font-medium leading-tight text-ink sm:text-4xl">
        {article.title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">
        {article.headline}
      </p>

      {!!article.authors?.length && (
        <p className="mt-3 font-mono text-xs text-stamp">
          {article.authors.join(" · ")}
        </p>
      )}
      {!!article.institutions?.length && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-stamp">
          {article.institutions.slice(0, 4).join(" · ")}
        </p>
      )}

      <h2 className="mb-3 mt-8 font-mono text-xs uppercase tracking-widest text-stamp sm:mt-10">
        Why it matters
      </h2>
      <ol className="flex flex-col gap-2">
        {article.why_it_matters.map((point, i) => (
          <li key={i} className="flex gap-3 text-ink">
            <span className="font-mono text-sm text-redpen">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="leading-relaxed">{point}</span>
          </li>
        ))}
      </ol>

      <div className="prose prose-lg mt-8 max-w-none whitespace-pre-line leading-relaxed text-ink sm:mt-10">
        {article.plain_explanation}
      </div>

      <div className="mt-8 rounded-sm border-l-2 border-redpen bg-redpen-soft/40 p-4 sm:mt-10 sm:p-5">
        <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-redpen">
          Editor&apos;s caveats
        </h3>
        <p className="text-sm leading-relaxed text-ink">{article.caveats}</p>
      </div>

      {!!(article.tags?.length || article.keywords?.length) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(article.tags?.length ? article.tags : article.keywords || []).map((t) => (
            <Link
              key={t}
              href={`/?tag=${encodeURIComponent(t)}`}
              className="rounded-full border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-stamp hover:border-ink hover:text-ink"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {sourceHref && (
        <p className="mt-8 font-mono text-xs uppercase tracking-wide">
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stamp hover:text-redpen"
          >
            Read the original paper →
          </a>
        </p>
      )}

      <SaveActions slug={article.slug} />

      <div className="mt-6 flex flex-wrap gap-3 border-t border-rule pt-6 font-mono text-xs uppercase tracking-wide text-ink-soft">
        <span className="text-stamp">Share:</span>
        <a
          href={share.x}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft hover:text-redpen"
        >
          X
        </a>
        <a
          href={share.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft hover:text-redpen"
        >
          LinkedIn
        </a>
        <a
          href={share.reddit}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft hover:text-redpen"
        >
          Reddit
        </a>
        <a
          href={`https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`${getSiteUrl()}/posts/${article.slug}`)}&t=${encodeURIComponent(article.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft hover:text-redpen"
        >
          HN
        </a>
      </div>

      {article.id && (
        <ArticleChat articleId={article.id} articleSlug={article.slug} />
      )}
    </article>
  );
}
