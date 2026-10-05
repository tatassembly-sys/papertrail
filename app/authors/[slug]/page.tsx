import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticles, resolveAuthorNameFromSlug } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";
import { getSiteUrl } from "@/lib/site-url";
import { jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = await resolveAuthorNameFromSlug(slug);
  if (!name) return { title: "Author" };
  return {
    title: name,
    description: `Plain-language notes on papers by ${name}.`,
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const name = await resolveAuthorNameFromSlug(slug);
  if (!name) notFound();

  const { articles, total } = await getPublishedArticles(1, 16, { author: name });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `${getSiteUrl()}/authors/${slug}`,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        <Link href="/authors" className="hover:text-redpen">
          Authors
        </Link>
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        {name}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {total} {total === 1 ? "note" : "notes"} on this byline.
      </p>
      {articles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No published notes for this author yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
