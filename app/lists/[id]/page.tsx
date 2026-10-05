import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection } from "@/lib/collections";
import { getPublishedArticlesBySlugs } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";
import { getSiteUrl } from "@/lib/site-url";
import { jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const list = await getCollection(id);
  if (!list || !list.public) return { title: "List", robots: { index: false } };
  return {
    title: list.name,
    description: list.description || `A Paper Trail reading list: ${list.name}`,
  };
}

export default async function PublicListPage({ params }: PageProps) {
  const { id } = await params;
  const list = await getCollection(id);
  if (!list || !list.public) notFound();
  const articles = await getPublishedArticlesBySlugs(list.slugs, 80);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.name,
    url: `${getSiteUrl()}/lists/${list.id}`,
    numberOfItems: articles.length,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Shared list
      </p>
      <h1 className="font-display text-3xl font-medium text-ink">{list.name}</h1>
      {list.description && (
        <p className="mt-2 text-base text-ink-soft">{list.description}</p>
      )}
      <p className="mt-2 text-sm text-ink-soft">
        {articles.length} {articles.length === 1 ? "note" : "notes"}. A public
        folder, like Semantic Scholar&apos;s shareable library.
      </p>
      {articles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">This list is empty.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
      <p className="mt-10 text-sm text-ink-soft">
        Start your own from{" "}
        <Link href="/library" className="text-redpen hover:underline">
          Library
        </Link>
        .
      </p>
    </div>
  );
}
