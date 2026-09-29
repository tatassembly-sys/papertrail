"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explain this paper simply",
  "What are the limitations?",
  "What are the practical applications?",
  "Compare with typical prior research",
];

export default function ArticleChat({ articleId }: { articleId: string }) {
  const inputId = useId();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [quota, setQuota] = useState<{
    remaining: number | null;
    limit: number | null;
    plan: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/articles/${articleId}/chat`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load chat.");
        return d;
      })
      .then((d) => {
        if (!cancelled && Array.isArray(d.messages)) setMessages(d.messages);
        if (!cancelled && d.quota) setQuota(d.quota);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load previous messages.");
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    setUpgrade(false);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);

    try {
      const res = await fetch(`/api/articles/${articleId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => m.slice(0, -1));
        setInput(message);
        setError(typeof body.error === "string" ? body.error : "Chat failed.");
        setUpgrade(body.code === "upgrade_required");
        setLoading(false);
        return;
      }
      if (body.quota) setQuota(body.quota);
      if (Array.isArray(body.messages)) setMessages(body.messages);
      else if (body.reply) {
        setMessages((m) => [...m, { role: "assistant", content: body.reply }]);
      }
    } catch {
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      setError("Network error.");
    }
    setLoading(false);
  }

  return (
    <section className="pt-card mt-14 p-4 sm:p-5">
      <h2 className="font-mono text-xs uppercase tracking-widest text-stamp">
        Ask about this paper
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        AI answers use only this article&apos;s summary. Free accounts get 5
        questions a day; Pro is unlimited.
      </p>
      {quota && quota.limit != null && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-stamp">
          {quota.remaining} of {quota.limit} free questions left today
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="rounded-full border border-rule bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-soft hover:border-ink hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="font-mono text-xs text-stamp">No messages yet.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-sm px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-6 bg-ink text-paper"
                : "mr-6 border border-rule bg-paper text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 pt-alert-error" role="alert">
          {error}{" "}
          {upgrade && (
            <Link href="/pricing" className="font-medium underline">
              See Pro
            </Link>
          )}
        </p>
      )}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask a question about this paper
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="pt-input flex-1"
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="pt-btn">
          {loading ? "Thinking…" : "Send"}
        </button>
      </form>
    </section>
  );
}
