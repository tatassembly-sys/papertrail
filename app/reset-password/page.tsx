"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error || "Reset failed.");
      return;
    }
    router.push("/user-login");
  }

  if (!token) {
    return (
      <p className="mt-4 text-sm text-ink-soft">
        Missing reset token.{" "}
        <Link href="/forgot-password" className="text-redpen underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">
        New password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="pt-input mt-1"
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
        className="min-h-11 rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Choose a new password
      </h1>
      <Suspense fallback={<p className="mt-4 text-sm text-ink-soft">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
