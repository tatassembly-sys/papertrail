import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for Paper Trail.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Legal
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Terms of use
      </h1>
      <p className="mt-2 text-sm text-stamp">Last updated: 15 September 2026</p>

      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
        <p>
          By using Paper Trail you agree to these terms. If you do not agree,
          do not use the site, create an account, or subscribe.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">The notes</h2>
        <p>
          Every published entry is an editorial translation of a real paper. It
          is not medical, legal, investment, or scientific advice. Always read
          the original paper — linked on the page — before relying on a claim.
          Caveats on each note are part of the record, not optional colour.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Accounts</h2>
        <p>
          You are responsible for the email and password you use. Do not share
          your login. We may suspend accounts used for abuse, scraping, or
          attempts to break the service.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Suggestions and chat</h2>
        <p>
          Sending a paper URL does not guarantee we will translate or publish
          it. Chat answers are generated from that article’s summary and can be
          wrong. Do not paste confidential material into chat or forms.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Intellectual property</h2>
        <p>
          Original papers remain with their authors and publishers. Paper Trail
          notes and the site design are ours. You may share links to published
          notes; do not scrape, bulk-copy, or republish the corpus as your own.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Availability</h2>
        <p>
          We aim to keep the site and weekly digest running, but we do not
          guarantee uptime, inbox delivery, or that any particular paper will
          appear. Features may change.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Liability</h2>
        <p>
          The site is provided as-is. To the extent the law allows, we are not
          liable for losses from relying on a note, a chat reply, or a period
          of downtime.
        </p>

        <p>
          Personal data is described in the{" "}
          <Link href="/privacy" className="text-redpen hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
