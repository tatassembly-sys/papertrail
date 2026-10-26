import type { Metadata } from "next";
import Link from "next/link";
import { getLastPublishMix } from "@/lib/publish-mix";
import { getPublishedArticlesBySlugs } from "@/lib/articles";
import { categoryLabel } from "@/lib/arxivCategories";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserPublic } from "@/lib/users";
import { personaliseMix } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: "Today",
  description: "Today's mix of translated papers — one note per field.",
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const mix = await getLastPublishMix().catch(() => null);
  const articles = mix?.items?.length
    ? await getPublishedArticlesBySlugs(mix.items.map((item) => String(item.slug || "")))
    : [];
  const session = await getCurrentUserSession().catch(() => null);
  const user = session ? await getUserPublic(session.userId).catch(() => null) : null;
  const followed = user?.followed_topics || [];
  const ordered = personaliseMix(articles, followed);

  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Daily briefing
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Today&apos;s mix
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        One paper per field, the way Nature Briefing and The Conversation keep a
        day small enough to finish. {mix?.dateKey ? `Filed ${mix.dateKey}.` : ""}
      </p>
      {user && followed.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          <Link href="/welcome" className="text-redpen underline underline-offset-2">
            Pick your topics
          </Link>{" "}
          to see your fields first.
        </p>
      ) : null}

      {articles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No mix filed yet. Check back after the daily publish.</p>
      ) : (
        <ol className="mt-8 divide-y divide-rule rounded-sm border border-rule bg-surface">
          {ordered.map(({ item: article, forYou }, i) => (
            <li key={article.slug}>
              <Link
                href={`/posts/${article.slug}`}
                className="flex gap-4 px-4 py-4 hover:bg-paper"
              >
                <span className="font-mono text-sm text-redpen">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-stamp">
                    {categoryLabel(article.category)}
                    {forYou ? " · For you" : ""}
                  </span>
                  <span className="mt-1 block font-medium text-ink">{article.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{article.headline}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-sm text-ink-soft">
        Want this in your inbox?{" "}
        <Link href="/newsletter" className="text-redpen underline underline-offset-2">
          Weekly digest
        </Link>
        .
      </p>
    </article>
  );
}
