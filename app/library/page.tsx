import Link from "next/link";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserPublic } from "@/lib/users";
import { listCollections } from "@/lib/collections";
import { listHighlights } from "@/lib/highlights";
import { getPublishedArticlesBySlugs } from "@/lib/articles";
import LibraryLists from "@/components/LibraryLists";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Your library
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          Sign in to keep reading lists, highlights, and saved papers — the
          Semantic Scholar / Readwise layer on top of the public notes.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/user-login?next=/library" className="pt-btn">
            Sign in
          </Link>
          <Link href="/register?next=/welcome" className="pt-btn-ghost">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const user = await getUserPublic(session.userId);
  const [collections, highlights] = await Promise.all([
    listCollections(session.userId),
    listHighlights(session.userId),
  ]);
  const slugs = [
    ...(user?.saved_slugs || []),
    ...(user?.bookmarks || []),
    ...collections.flatMap((c) => c.slugs),
    ...highlights.map((h) => h.article_slug),
  ];
  const listed = await getPublishedArticlesBySlugs(slugs, 80);
  const titles: Record<string, string> = {};
  for (const a of listed) titles[a.slug] = a.title;

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
          Library
        </p>
        <h1 className="font-display text-3xl font-medium text-ink">Your papers</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Saved notes, reading lists, and highlights.{" "}
          <Link href="/account" className="text-redpen hover:underline">
            Account
          </Link>
        </p>
      </div>

      <LibraryLists titles={titles} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
          Highlights
        </h2>
        {highlights.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            Select a passage on any article to save it here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {highlights.slice(0, 40).map((h) => (
              <li key={h.id} className="border-l-2 border-redpen px-3 py-1">
                <Link
                  href={`/posts/${h.article_slug}`}
                  className="font-mono text-[10px] uppercase tracking-wide text-stamp hover:text-redpen"
                >
                  {titles[h.article_slug] || h.article_slug}
                </Link>
                {h.quote && (
                  <blockquote className="mt-1 text-sm italic text-ink">{h.quote}</blockquote>
                )}
                {h.note && <p className="mt-1 text-sm text-ink-soft">{h.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
