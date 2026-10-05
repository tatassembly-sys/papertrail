"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function VerifyEmailForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = sp.get("token") || "";
  const [token, setToken] = useState(tokenFromUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setMsg(body.error || "Could not verify email.");
        return;
      }
      router.push("/account?verified=1");
    } catch {
      setLoading(false);
      setMsg("Network error.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="font-mono text-xs uppercase tracking-widest text-stamp">Account</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Verify your email</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Confirm this is your address. Mail apps that prefetch links cannot verify you
        automatically.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="font-mono text-[10px] uppercase tracking-wide text-stamp">
          Verification token
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="pt-input mt-1"
            placeholder="Token from email"
          />
        </label>
        {msg && <p className="text-sm text-redpen">{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-sm bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
        >
          {loading ? "Working…" : "Verify email"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/account" className="text-redpen hover:underline">
          ← Back to account
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
