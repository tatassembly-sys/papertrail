"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "url" | "text";

function ManualInputForm() {
  const searchParams = useSearchParams();
  const prefilledUrl = searchParams.get("url") || "";
  const submissionId = searchParams.get("submissionId");

  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState(prefilledUrl);
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // If arriving with a prefilled URL after the initial render (e.g. back/forward nav)
  useEffect(() => {
    if (prefilledUrl) setUrl(prefilledUrl);
  }, [prefilledUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload =
      mode === "url" ? { url } : { rawText, sourceUrl: sourceUrl || undefined };

    const res = await fetch("/api/process-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(body.error || "Something went wrong processing that paper.");
      return;
    }

    if (submissionId) {
      // Best-effort — don't block navigation on this
      fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processed" }),
      }).catch(() => {});
    }

    router.push(`/admin/${body.article.id}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={submissionId ? "/admin/submissions" : "/admin"}
        className="mb-6 inline-block text-sm text-ink-soft hover:text-ink hover:underline"
      >
        ← Back to {submissionId ? "suggestions" : "dashboard"}
      </Link>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink">Process a paper</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {submissionId
          ? "Pre-filled from a visitor suggestion — edit before processing if needed."
          : "Best for arXiv: paste a link. For paywalled or non-arXiv sources, paste the text directly — automatic extraction isn't reliable off-site."}
      </p>

      <div className="mb-6 flex gap-1 rounded-sm border border-rule bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 rounded-sm px-3 py-1.5 font-medium transition ${
            mode === "url"
              ? "bg-ink text-paper"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Paste a link
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`flex-1 rounded-sm px-3 py-1.5 font-medium transition ${
            mode === "text"
              ? "bg-ink text-paper"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Paste text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "url" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="url" className="text-sm font-medium text-ink">
              arXiv link or ID
            </label>
            <input
              id="url"
              type="text"
              required
              placeholder="https://arxiv.org/abs/2401.12345"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pt-input"
            />
            <p className="text-xs text-stamp">
              Accepts an abstract page, PDF link, or bare ID like{" "}
              <code className="rounded bg-paper px-1 text-ink">2401.12345</code>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="rawText" className="text-sm font-medium text-ink">
                Paper text (abstract, or as much of the paper as you have)
              </label>
              <textarea
                id="rawText"
                required
                rows={10}
                minLength={200}
                placeholder="Paste the abstract or body text here…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="pt-input"
              />
              <p className="text-xs text-stamp">Minimum 200 characters.</p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="sourceUrl" className="text-sm font-medium text-ink">
                Source URL
              </label>
              <input
                id="sourceUrl"
                type="text"
                required
                placeholder="https://example.com/paper"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="pt-input"
              />
              <p className="text-xs text-stamp">
                Required — every article here links back to its original source.
              </p>
            </div>
          </>
        )}

        {error && <p className="pt-alert-error">{error}</p>}

        <button type="submit" disabled={loading} className="pt-btn">
          {loading ? "Processing… this can take up to a minute" : "Process paper"}
        </button>
      </form>
    </div>
  );
}

export default function ManualInputPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <ManualInputForm />
    </Suspense>
  );
}
