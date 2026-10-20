import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticles, resolvePublishedTag } from "@/lib/articles";
import { slugifyLabel } from "@/lib/name-slug";
import { topicIsOnFile } from "@/lib/public-route";
import ArticleCard from "@/components/ArticleCard";
import FollowTopic from "@/components/FollowTopic";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const label = await resolvePublishedTag(tag);
  if (!topicIsOnFile(label)) {
    return { title: "Not on file", robots: { index: false, follow: false } };
  }
  return {
    title: label,
    description: `Plain-language notes on ${label}.`,
  };
}

export default async function TopicPage({ params }: PageProps) {
  const { tag } = await params;
  const label = await resolvePublishedTag(tag);
  // notFound() before any shell. Do not add loading.tsx on this segment.
  if (!topicIsOnFile(label)) notFound();

  const { articles, total } = await getPublishedArticles(1, 16, { tag: label });

  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        <Link href="/topics" className="hover:text-redpen">
          Topics
        </Link>
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        {label}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {total} {total === 1 ? "note" : "notes"}.{" "}
        <Link href={`/?tag=${encodeURIComponent(label)}`} className="text-redpen hover:underline">
          Open in search
        </Link>
        {" · "}
        <a href={`/feed.xml?tag=${encodeURIComponent(label)}`} className="text-redpen hover:underline">
          RSS
        </a>
      </p>
      <FollowTopic topic={label} nextPath={`/topics/${encodeURIComponent(slugifyLabel(label))}`} />
      {articles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">Nothing filed under this topic yet.</p>
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
