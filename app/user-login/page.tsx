"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { safeRelativePath } from "@/lib/safe-redirect";

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/user-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(body.error || "Sign in failed.");
        return;
      }

      const next = safeRelativePath(
        new URLSearchParams(window.location.search).get("next"),
        "/account"
      );
      router.push(next);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error — try again.");
    }
  }

  const input = "pt-input";

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
        Sign in
      </h1>
      <p className="mt-2 text-base text-ink-soft">
        Access your saved papers, bookmarks, and history.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-medium text-ink">
          Email
          <input
            className={`${input} mt-1`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Password
          <input
            className={`${input} mt-1`}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Your password"
          />
        </label>

        {error && (
          <p className="text-sm text-redpen" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 space-x-4 text-sm text-ink-soft">
        <Link href="/register" className="font-medium text-redpen hover:underline">
          Create account
        </Link>
        <Link href="/forgot-password" className="hover:text-redpen hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
