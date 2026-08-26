"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function UnsubscribeForm() {
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
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setMsg(body.error || "Could not unsubscribe.");
        return;
      }
      router.push("/newsletter?unsubscribed=1");
    } catch {
      setLoading(false);
      setMsg("Network error.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="font-mono text-xs uppercase tracking-widest text-stamp">
        Newsletter
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
        Unsubscribe
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Paste the token from your email link, or open the unsubscribe link in the
        digest directly.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="font-mono text-[10px] uppercase tracking-wide text-stamp">
          Unsubscribe token
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
          {loading ? "Working…" : "Unsubscribe"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/newsletter" className="text-redpen hover:underline">
          ← Back to newsletter
        </Link>
      </p>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <UnsubscribeForm />
    </Suspense>
  );
}
