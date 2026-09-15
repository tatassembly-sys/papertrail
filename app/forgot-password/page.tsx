"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(
        typeof body.error === "string"
          ? body.error
          : "Could not send a reset link. Try again later."
      );
      return;
    }
    setDone(true);
    if (body.resetUrl) setDevUrl(body.resetUrl);
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Reset password</h1>
      <p className="mt-2 text-base text-ink-soft">
        Enter your account email. We&apos;ll send a reset link if it exists.
      </p>

      {done ? (
        <div className="mt-6 space-y-3 text-sm text-ink-soft">
          <p>If that email is registered, a reset link was generated.</p>
          {devUrl && (
            <a href={devUrl} className="block break-all text-redpen underline">
              Open reset link
            </a>
          )}
          <Link href="/user-login" className="inline-block text-redpen hover:underline">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="reset-email" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="pt-input"
          />
          {error && (
            <p className="text-sm text-redpen" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}
