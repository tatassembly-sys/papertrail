import Link from "next/link";
import { getForYouArticles } from "@/lib/articles";

export default async function ForYou({ topics }: { topics: string[] }) {
  const articles = await getForYouArticles(topics, 4).catch(() => []);
  if (!articles.length) return null;

  return (
    <section className="mb-8 sm:mb-10" aria-labelledby="for-you">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="for-you" className="font-mono text-xs uppercase tracking-widest text-stamp">
          For you
        </h2>
        <Link href="/welcome" className="text-xs text-ink-soft hover:text-redpen">
          Edit topics
        </Link>
      </div>
      <ul className="divide-y divide-rule rounded-sm border border-rule bg-surface">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/posts/${article.slug}`}
              className="block px-4 py-3 hover:bg-paper"
            >
              <span className="text-sm font-medium text-ink">{article.title}</span>
              <span className="mt-0.5 block line-clamp-1 text-sm text-ink-soft">
                {article.headline}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
