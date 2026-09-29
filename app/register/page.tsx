"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { safeRelativePath } from "@/lib/safe-redirect";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVerifyUrl(null);
    if (password !== confirm) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(body.error || "Registration failed.");
        return;
      }

      if (typeof body.verifyUrl === "string") setVerifyUrl(body.verifyUrl);
      const next = safeRelativePath(
        new URLSearchParams(window.location.search).get("next"),
        "/account"
      );
      router.push(next === "/account" ? "/account?registered=1" : next);
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
        Create account
      </h1>
      <p className="mt-2 text-base leading-relaxed text-ink-soft">
        Save papers, bookmark favorites, follow topics, and keep reading
        history. Upgrade anytime from{" "}
        <Link href="/pricing" className="text-redpen hover:underline">
          Pro
        </Link>
        .
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-medium text-ink">
          Name
          <input
            className={`${input} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
          />
        </label>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Confirm password
          <input
            className={`${input} mt-1`}
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Repeat password"
          />
        </label>
        <p className="text-xs text-ink-soft">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="text-redpen hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-redpen hover:underline">
            privacy policy
          </Link>
          .
        </p>

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
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      {verifyUrl && (
        <p className="mt-4 break-all rounded-sm border border-dashed border-rule p-3 text-sm">
          Verify email:{" "}
          <a href={verifyUrl} className="text-redpen underline">
            {verifyUrl}
          </a>
        </p>
      )}

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/user-login" className="font-medium text-redpen hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
