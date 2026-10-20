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
      <p className="mt-2 text-sm text-stamp">Last updated: 19 October 2026</p>

      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
        <p>
          This notice describes what the Paper Trail site actually stores. It is
          written from the data inventory in the project. It is not a lawyer’s
          sign-off. The controller’s name and address are still a placeholder
          for the owner.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Who we are</h2>
        <p>
          Controller: [controller name and address — owner]. Until that line is
          replaced, do not treat any other name on this site as the legal
          controller.
        </p>
        <p>
          Paper Trail publishes plain-language notes on academic papers. For a
          privacy request, use the{" "}
          <Link href="/submit" className="text-redpen hover:underline">
            suggest a paper
          </Link>{" "}
          form and put “privacy request” in the note, or write to the
          controller once an address is published. You can also complain to the
          Information Commissioner’s Office (ico.org.uk).
        </p>

        <h2 className="font-display text-xl font-medium text-ink">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Account:</strong> email, display name,
            a hash of your password (never the password itself), saved papers,
            bookmarks, followed topics, and reading history. If you use Pro, we
            store the plan status and Stripe customer and subscription ids. We
            never store the card number.
          </li>
          <li>
            <strong className="text-ink">Newsletter:</strong> email, whether you
            are pending, active, or unsubscribed, and hashed tokens for confirm
            and unsubscribe. Confirming is a deliberate click. Opening the link
            (a GET) does not subscribe you.
          </li>
          <li>
            <strong className="text-ink">Suggestions and lab enquiries:</strong>{" "}
            the paper URL, any note you type, and — for suggestions — a one-way
            hash of your IP used only to limit abuse. Enquiries also store your
            name, work email, and organisation.
          </li>
          <li>
            <strong className="text-ink">Article chat:</strong> the question you
            ask and the reply, tied to your account or to a chat cookie so the
            thread can continue.
          </li>
          <li>
            <strong className="text-ink">Security counters:</strong> a hash of
            your IP for failed sign-ins and for rate limits. The raw IP is not
            written to the database. Some limits are counted against your user
            id instead.
          </li>
          <li>
            <strong className="text-ink">Papers:</strong> author names and
            institutions from the source paper are stored so a note can credit
            them. That is bibliographic data, not a reader account.
          </li>
        </ul>

        <h2 className="font-display text-xl font-medium text-ink">Why we use it</h2>
        <p>
          The purposes are running your account, sending a digest you confirmed,
          answering a chat question from that note, limiting abuse, and
          publishing credited notes. The draft UK GDPR Article 6 labels for
          each field are in the data inventory and are waiting for the owner to
          confirm. In short: accounts and Pro are the contract for the service
          you asked for; the newsletter is consent; rate limits and security
          logs are legitimate interests. We do not sell personal data. We do
          not run third-party advertising or analytics.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Cookies</h2>
        <p>
          The only cookies are a reader session, a staff session, and a chat
          thread key. They are strictly necessary for those features. Theme is
          stored in localStorage on your device and is not a cookie. Details
          are on the{" "}
          <Link href="/cookies" className="text-redpen hover:underline">
            cookie page
          </Link>
          . There is no consent banner because there is no analytics cookie.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Processors</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">MongoDB Atlas</strong> stores the
            database.
          </li>
          <li>
            <strong className="text-ink">Vercel</strong> hosts the site. The
            configured region is London (<span className="font-mono">lhr1</span>
            ).
          </li>
          <li>
            <strong className="text-ink">Resend</strong> sends email when it is
            configured. If it is not, the app does not claim a message was
            delivered.
          </li>
          <li>
            <strong className="text-ink">OpenRouter</strong> receives paper text
            and chat questions when a note is drafted or you use article chat.
            An xAI fallback can receive the same prompt if that key is set.
          </li>
          <li>
            <strong className="text-ink">Stripe</strong> handles card payments
            only when billing is switched on. While it is off, checkout does
            not run.
          </li>
        </ul>
        <p>
          Optional social posting (X, Reddit, Facebook, Instagram) sends a
          public caption of a note, not your account, and only if those keys
          are set.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">
          International transfers
        </h2>
        <p>
          The site is aimed at readers in the United Kingdom. Some processors
          are outside the UK:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Vercel</strong> runs this app in London,
            but Vercel is a US company and logs or control traffic may be
            processed in the US.
          </li>
          <li>
            <strong className="text-ink">MongoDB Atlas</strong> can sit in the
            UK, the EEA, or the US. The live cluster region is set in the Atlas
            project, not in this page. The owner has to name that region.
          </li>
          <li>
            <strong className="text-ink">OpenRouter</strong> (and xAI, if used)
            can process prompts in the United States or in the country of the
            model provider.
          </li>
          <li>
            <strong className="text-ink">Resend and Stripe</strong> process in
            the United States and, for Stripe, other regions Stripe publishes.
          </li>
        </ul>
        <p>
          Where a transfer needs a UK safeguard, the owner must rely on the
          provider’s UK Addendum to the EU standard contractual clauses, or
          another transfer tool they have actually put in place. This page does
          not claim those contracts have been signed.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Retention</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data stays until you delete the account.</li>
          <li>
            Newsletter rows stay after you unsubscribe so we do not treat the
            same address as a fresh consent. There is no automatic deletion
            date in the code yet.
          </li>
          <li>
            Failed sign-in records expire after one hour. Rate-limit counters
            expire after eight days.
          </li>
          <li>
            Chats linked to your account are deleted with the account. Chats
            that exist only under the chat cookie are not on a timer in the
            database.
          </li>
          <li>
            Suggestions, lab enquiries, and operational logs have no expiry in
            the code. The owner still has to set one.
          </li>
          <li>
            Published notes are editorial pages. They are not your profile.
          </li>
        </ul>

        <h2 className="font-display text-xl font-medium text-ink">Your rights</h2>
        <p>
          If UK GDPR applies, you can ask to access your data, correct it,
          erase it, restrict it, receive a portable copy, object to processing
          based on legitimate interests, and withdraw consent. You can also
          complain to the ICO. We do not make solely automated decisions that
          produce legal effects about you.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Access and a copy:</strong> the account
            page shows your profile. A JSON download of your own records is
            linked from that page.
          </li>
          <li>
            <strong className="text-ink">Correction:</strong> change your name
            and topics on the account page, and remove saves or bookmarks
            there.
          </li>
          <li>
            <strong className="text-ink">Erasure:</strong> delete the account on
            that page. That removes your profile, lists, highlights, and chats
            tied to you, unsubscribes the email, and cancels a stored
            subscription. It does not delete other people’s data.
          </li>
          <li>
            <strong className="text-ink">Withdraw consent:</strong> use the
            unsubscribe link in a newsletter email. One click is enough. You
            can also ignore a confirmation email and you will not be subscribed.
          </li>
        </ul>
        <p>
          Restriction, objection, and anything the account page cannot do are
          handled by the controller once a contact address is published.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Children</h2>
        <p>
          The site is for a general adult audience. Do not create an account if
          you are under 16.
        </p>

        <p>
          See also the{" "}
          <Link href="/cookies" className="text-redpen hover:underline">
            cookie page
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className="text-redpen hover:underline">
            terms of use
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
