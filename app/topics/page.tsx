import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedTagCounts } from "@/lib/articles";
import { slugifyLabel } from "@/lib/name-slug";

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse Paper Trail notes by topic.",
};

export const dynamic = "force-dynamic";

export default async function TopicsIndexPage() {
  const tags = await getPublishedTagCounts(80).catch(() => []);

  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Field guide
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Topics
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Like The Conversation&apos;s topic pages — a public index of every label
        we&apos;ve filed, so search engines and curious readers can start from a
        field instead of a homepage.
      </p>
      {tags.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No topics yet.</p>
      ) : (
        <ul className="mt-8 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link
                href={`/topics/${encodeURIComponent(slugifyLabel(t.tag))}`}
                className="inline-flex min-h-9 items-center rounded-full border border-rule bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-ink hover:border-ink"
              >
                {t.tag}
                <span className="ml-1 text-stamp">({t.count})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
