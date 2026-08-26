import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Paper Trail",
  description:
    "How Paper Trail translates academic papers into plain language, and what we never do.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        About this project
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Research, filed in plain language.
      </h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
        <p>
          Paper Trail takes real papers from arXiv and PubMed and writes a
          careful, readable note for people who are curious but not in the field.
          Every published entry keeps a link to the original paper.
        </p>
        <p>
          Most drafts stay in the admin queue until an editor publishes them.
          Once a day we also release a small mix — at most one note per field —
          so search covers tech, space, math, and more without dumping the whole
          crawl. Every live entry still links to the original paper. If a study
          has limits — small sample, narrow setting, early results — those
          caveats stay on the page.
        </p>
        <p>
          You can follow new notes by{" "}
          <Link href="/newsletter" className="text-redpen hover:underline">
            newsletter
          </Link>{" "}
          or{" "}
          <a href="/feed.xml" className="text-redpen hover:underline">
            RSS
          </a>
          . Suggest a paper on the{" "}
          <Link href="/submit" className="text-redpen hover:underline">
            suggest
          </Link>{" "}
          page.
        </p>
      </div>
    </article>
  );
}
