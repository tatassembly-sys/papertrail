"use client";

import { useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  kicker: string;
  title: string;
  blurb: string;
  tokenLabel: string;
  submitLabel: string;
  endpoint: string;
  successPath: string;
  backHref: string;
  backLabel: string;
  errorFallback: string;
};

function TokenActionInner({
  kicker,
  title,
  blurb,
  tokenLabel,
  submitLabel,
  endpoint,
  successPath,
  backHref,
  backLabel,
  errorFallback,
}: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = (sp.get("token") || "").trim().slice(0, 128);
  const [token, setToken] = useState(tokenFromUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim().slice(0, 128) }),
      });
      const body = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setMsg(typeof body.error === "string" ? body.error : errorFallback);
        return;
      }
      router.push(successPath);
    } catch {
      setLoading(false);
      setMsg("Network error.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="font-mono text-xs uppercase tracking-widest text-stamp">{kicker}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{blurb}</p>
      {!tokenFromUrl && (
        <p className="mt-3 text-sm text-ink-soft">
          Open the link in your email. If it is missing, paste the token from that message.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        {tokenFromUrl ? (
          <input type="hidden" name="token" value={token} />
        ) : (
          <label className="font-mono text-[10px] uppercase tracking-wide text-stamp">
            {tokenLabel}
            <input
              value={token}
              onChange={(e) => setToken(e.target.value.slice(0, 128))}
              required
              className="pt-input mt-1"
              placeholder="Token from email"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        {msg && <p className="text-sm text-redpen">{msg}</p>}
        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="min-h-11 rounded-sm bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
        >
          {loading ? "Working…" : submitLabel}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href={backHref} className="text-redpen hover:underline">
          {backLabel}
        </Link>
      </p>
    </div>
  );
}

export default function TokenActionForm(props: Props): ReactNode {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <TokenActionInner {...props} />
    </Suspense>
  );
}
