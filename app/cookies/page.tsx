import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookies Paper Trail sets, and why each one is strictly necessary.",
};

export default function CookiesPage() {
  return (
    <article className="prose prose-ink mx-auto max-w-2xl prose-headings:font-display prose-headings:font-medium prose-a:text-redpen">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Legal
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Cookies
      </h1>
      <p className="mt-2 text-sm text-stamp">Last updated: 19 October 2026</p>

      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
        <p>
          Paper Trail sets three cookies. Each one is strictly necessary for a
          feature you asked for: staying signed in, or continuing an article
          chat. We do not set analytics, advertising, or third-party cookies.
          Because of that, the site does not show a cookie consent banner. If
          an analytics cookie is added later, a banner has to come first.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">Cookies we set</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">
              <span className="font-mono">pt_user</span>
            </strong>{" "}
            — reader session. Set when you create an account or sign in.
            Cleared when you sign out or delete the account. HttpOnly, SameSite
            Lax, path <span className="font-mono">/</span>, 14 days. The Secure
            flag is on in production. Strictly necessary so the account, library,
            and Pro status stay yours.
          </li>
          <li>
            <strong className="text-ink">
              <span className="font-mono">pt_session</span>
            </strong>{" "}
            — staff session. Set only on the staff sign-in form and cleared on
            staff logout. HttpOnly, SameSite Lax, path{" "}
            <span className="font-mono">/</span>, 7 days. Secure in production.
            Strictly necessary for the admin area. Readers do not get this
            cookie.
          </li>
          <li>
            <strong className="text-ink">
              <span className="font-mono">pt_chat</span>
            </strong>{" "}
            — article chat key. Set when you start a chat without an account, so
            the same thread can continue and the chat rate limit can be applied.
            HttpOnly, SameSite Lax, path <span className="font-mono">/</span>,
            30 days. Secure in production. Strictly necessary for that chat. It
            is not used to measure an audience.
          </li>
        </ul>

        <h2 className="font-display text-xl font-medium text-ink">Not a cookie</h2>
        <p>
          The light or dark theme is stored in your browser as{" "}
          <span className="font-mono">localStorage</span> under{" "}
          <span className="font-mono">pt-theme</span>. It stays on your device
          and is not sent as an account field.
        </p>

        <h2 className="font-display text-xl font-medium text-ink">How to refuse</h2>
        <p>
          You can block cookies in your browser. Blocking{" "}
          <span className="font-mono">pt_user</span> means the site cannot keep
          you signed in. Blocking <span className="font-mono">pt_chat</span>{" "}
          means an anonymous chat will not resume. Public notes stay readable
          without any cookie.
        </p>

        <p>
          See also the{" "}
          <Link href="/privacy" className="text-redpen underline underline-offset-2">
            privacy policy
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className="text-redpen underline underline-offset-2">
            terms of use
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
