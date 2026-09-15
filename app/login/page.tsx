"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeRelativePath } from "@/lib/safe-redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof body.error === "string" ? body.error : "Sign in failed. Check email and password."
        );
        setLoading(false);
        return;
      }

      // Avoid useSearchParams() (forces Suspense + blank shell). Read redirect from URL.
      const redirectedFrom =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirectedFrom")
          : null;

      router.push(safeRelativePath(redirectedFrom, "/admin"));
      router.refresh();
    } catch {
      setError("Network error — could not reach the server. Try again.");
      setLoading(false);
    }
  }

  const inputClass = "pt-input";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-stamp">
        Admin access
      </p>
      <h1 className="mb-6 font-display text-2xl font-medium text-ink">Sign in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="font-mono text-xs uppercase tracking-wide text-ink-soft"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="font-mono text-sm text-redpen" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 min-h-11 rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
