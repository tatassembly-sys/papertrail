import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Paper Trail collects, uses, and stores personal data.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-ink mx-auto max-w-2xl prose-headings:font-display prose-headings:font-medium prose-a:text-redpen">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Legal
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Privacy policy
      </h1>
      <p className="mt-2 text-sm text-stamp">Last updated: 15 September 2026</p>

      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
        <p>
          Paper Trail (“we”) publishes plain-language notes on academic papers.
          This policy explains what we collect when you use the public site,
          create an account, subscribe to email, or suggest a paper.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Who we are</h2>
        <p>
          Paper Trail is operated as an independent editorial project hosted in
          the United Kingdom / EU cloud (Railway). For privacy questions use the{" "}
          <Link href="/submit" className="text-redpen hover:underline">
            suggest a paper
          </Link>{" "}
          form and mark the note as a privacy request.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Account data:</strong> email, display
            name, password hash (we never store the plaintext password), saved
            papers, bookmarks, followed topics, and reading history.
          </li>
          <li>
            <strong className="text-ink">Newsletter:</strong> email address and
            subscription status, plus tokens used to confirm or unsubscribe.
          </li>
          <li>
            <strong className="text-ink">Suggestions:</strong> the paper URL,
            optional note, and a one-way hash of your IP used only to rate-limit
            abuse.
          </li>
          <li>
            <strong className="text-ink">Article chat:</strong> questions you ask
            about a published note, stored against a session cookie or your
            account so the thread can continue.
          </li>
          <li>
            <strong className="text-ink">Cookies:</strong> httpOnly session
            cookies for signed-in readers and editors, plus a chat session
            cookie. Theme preference is stored in localStorage on your device.
          </li>
        </ul>

        <h2 className="font-display text-xl font-medium text-ink">Why we use it</h2>
        <p>
          To run the site, keep you signed in, send the weekly digest you asked
          for, prevent spam, and (if you use chat) answer questions from that
          article’s text. We do not sell personal data. We do not run
          third-party advertising trackers.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Processors</h2>
        <p>
          Hosting and MongoDB: Railway. AI replies and paper translation:
          OpenRouter (and, if configured, xAI). Email, when configured: Resend.
          Those providers only see what is required to perform that job.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Retention</h2>
        <p>
          Account data stays until you delete the account. Newsletter data stays
          until you unsubscribe. Rate-limit records expire automatically.
          Published articles are editorial content, not personal profiles.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Your rights</h2>
        <p>
          You can access and update your profile while signed in, unsubscribe
          from email, and delete your account from the account page. That
          removes your profile, saves, bookmarks, and history. Chat threads
          keyed only to a browser cookie disappear when that cookie expires.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Children</h2>
        <p>
          The site is intended for a general adult audience. Do not create an
          account if you are under 16.
        </p>

        <p>
          See also our{" "}
          <Link href="/terms" className="text-redpen hover:underline">
            terms of use
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
