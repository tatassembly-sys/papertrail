import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedAuthorCounts } from "@/lib/articles";
import { slugifyLabel } from "@/lib/name-slug";

export const metadata: Metadata = {
  title: "Authors",
  description: "Researchers whose papers Paper Trail has translated.",
};

export const dynamic = "force-dynamic";

export default async function AuthorsIndexPage() {
  const authors = await getPublishedAuthorCounts(80).catch(() => []);

  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Byline index
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Authors
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Semantic Scholar-style author pages, but for the plain-language notes —
        every name we&apos;ve printed, with the papers behind them.
      </p>
      {authors.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No authors indexed yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-rule rounded-sm border border-rule bg-surface">
          {authors.map((a) => (
            <li key={a.name}>
              <Link
                href={`/authors/${encodeURIComponent(slugifyLabel(a.name))}`}
                className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-paper"
              >
                <span className="font-medium text-ink">{a.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-stamp">
                  {a.count} {a.count === 1 ? "note" : "notes"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
