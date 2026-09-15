"use client";

import { useState } from "react";

export default function SubmitPage() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — stays empty for real visitors
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, note, website }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setMessage(body.error || "Something went wrong. Please try again.");
      return;
    }

    setStatus("done");
    setMessage(body.note || "Thanks — our editors review every submission before anything gets translated or published.");
    setUrl("");
    setNote("");
  }

  const inputClass = "pt-input";

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Suggest a paper
      </p>
      <h1 className="font-display text-3xl font-medium text-ink">
        Know a paper worth translating?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Send us a link. Every suggestion is reviewed by an editor before it's translated
        or published — nothing goes live automatically, and submitting doesn't guarantee
        it'll be picked up.
      </p>

      {status === "done" ? (
        <div className="mt-8 rounded-sm border-l-2 border-redpen bg-redpen-soft/40 p-5">
          <p className="text-sm leading-relaxed text-ink">{message}</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 font-mono text-xs uppercase tracking-wide text-redpen hover:underline"
          >
            Suggest another →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {/* Honeypot field — hidden from real visitors via CSS, bots often fill every field */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="url" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
              Paper URL
            </label>
            <input
              id="url"
              type="url"
              required
              placeholder="https://arxiv.org/abs/2401.12345"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="note" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
              Why it matters <span className="normal-case text-stamp">(optional)</span>
            </label>
            <textarea
              id="note"
              rows={3}
              placeholder="Anything that'd help an editor decide if this is worth covering…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </div>

          {status === "error" && <p className="font-mono text-sm text-redpen">{message}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:opacity-50"
          >
            {status === "loading" ? "Sending…" : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
