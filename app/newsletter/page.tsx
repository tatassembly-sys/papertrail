"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function NewsletterForm() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  const banner =
    sp.get("confirmed") === "1"
      ? "You’re confirmed — welcome to the weekly digest."
      : sp.get("confirmed") === "0"
        ? "That confirmation link is invalid or expired."
        : sp.get("unsubscribed") === "1"
          ? "You’ve been unsubscribed. You can rejoin anytime below."
          : sp.get("unsubscribed") === "0"
            ? "That unsubscribe link is invalid."
            : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMsg(null);
    setVerifyUrl(null);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMsg(body.error || "Subscribe failed.");
        return;
      }
      setStatus("done");
      setMsg(body.note || "Check your email to confirm.");
      if (typeof body.verifyUrl === "string") setVerifyUrl(body.verifyUrl);
      setEmail("");
    } catch {
      setStatus("error");
      setMsg("Network error — try again.");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-mono text-xs uppercase tracking-widest text-stamp">
        Weekly digest
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Paper Trail newsletter
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Every week: newest papers, trending notes, editor picks, and a short AI
        summary of the week — in plain language.
      </p>

      <ul className="mt-5 space-y-2 text-sm text-ink-soft">
        <li className="flex gap-2">
          <span className="text-redpen">✓</span> Newest translations
        </li>
        <li className="flex gap-2">
          <span className="text-redpen">✓</span> Trending articles
        </li>
        <li className="flex gap-2">
          <span className="text-redpen">✓</span> Editor picks
        </li>
        <li className="flex gap-2">
          <span className="text-redpen">✓</span> AI weekly summary
        </li>
      </ul>

      {banner && (
        <p
          className="mt-5 rounded-sm border border-rule bg-surface px-3 py-2 text-sm text-ink"
          role="status"
        >
          {banner}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="pt-input flex-1"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="min-h-11 rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>

      {msg && (
        <p
          className={`mt-3 text-sm ${status === "error" ? "text-redpen" : "text-ink-soft"}`}
          role="status"
        >
          {msg}
        </p>
      )}

      {verifyUrl && (
        <p className="mt-3 rounded-sm border border-dashed border-rule p-3 text-sm">
          <span className="font-medium text-ink">Confirm your email:</span>{" "}
          <a href={verifyUrl} className="break-all text-redpen underline">
            {verifyUrl}
          </a>
        </p>
      )}

      <p className="mt-8 text-sm text-ink-soft">
        Already subscribed?{" "}
        <Link href="/newsletter/unsubscribe" className="text-redpen hover:underline">
          Unsubscribe
        </Link>
      </p>
    </div>
  );
}

export default function NewsletterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <NewsletterForm />
    </Suspense>
  );
}
