"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

interface Highlight {
  id: string;
  quote: string;
  note: string;
}

export default function HighlightTools({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<Highlight[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [sel, setSel] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await fetch("/api/me").then((r) => r.json()).catch(() => ({}));
    if (!me?.user) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const d = await fetch(`/api/highlights?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .catch(() => ({}));
    setItems(Array.isArray(d.highlights) ? d.highlights : []);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function onMouseUp() {
    const text = window.getSelection()?.toString().trim() || "";
    if (text.length >= 8 && text.length <= 800) setSel(text);
  }

  async function save(quote: string, extraNote: string) {
    setBusy(true);
    setMsg(null);
    setUpgrade(false);
    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, quote, note: extraNote }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 401) {
      setMsg("Sign in to keep highlights.");
      return;
    }
    if (!res.ok) {
      setMsg(body.error || "Could not save.");
      setUpgrade(body.code === "upgrade_required");
      return;
    }
    setSel("");
    setNote("");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/highlights/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div>
      <div onMouseUp={onMouseUp}>{children}</div>
      {sel && (
        <div className="mt-3 rounded-sm border border-rule bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-stamp">
            Save highlight
          </p>
          <blockquote className="mt-1 line-clamp-4 text-sm italic text-ink">{sel}</blockquote>
          <label className="mt-2 block text-sm text-ink-soft">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="pt-input mt-1"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(sel, note)}
              className="pt-btn"
            >
              {busy ? "Saving…" : signedIn ? "Save" : "Sign in to save"}
            </button>
            <button type="button" onClick={() => setSel("")} className="pt-btn-ghost">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="mt-8 border-t border-rule pt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-stamp">
          Your notes
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Select a passage above to highlight it — a Readwise-style commonplace book
          for this note.
        </p>
        {!signedIn && (
          <p className="mt-2 text-sm">
            <Link href="/user-login" className="text-redpen hover:underline">
              Sign in
            </Link>{" "}
            to keep notes across devices.
          </p>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) save("", note.trim());
          }}
        >
          <label className="text-sm font-medium text-ink">
            Add a note
            <textarea
              value={sel ? note : note}
              onChange={(e) => setNote(e.target.value)}
              className="pt-input mt-1 min-h-20"
              placeholder="What do you want to remember?"
            />
          </label>
          <button type="submit" disabled={busy || !note.trim()} className="pt-btn w-fit">
            Save note
          </button>
        </form>
        {msg && (
          <p className="mt-2 text-sm text-ink-soft">
            {msg}{" "}
            {upgrade && (
              <Link href="/pricing" className="text-redpen hover:underline">
                See Pro
              </Link>
            )}
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {items.map((h) => (
            <li key={h.id} className="border-l-2 border-redpen bg-redpen-soft/30 px-3 py-2">
              {h.quote && (
                <blockquote className="text-sm italic text-ink">{h.quote}</blockquote>
              )}
              {h.note && <p className="mt-1 text-sm text-ink-soft">{h.note}</p>}
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="mt-1 text-xs text-stamp hover:text-redpen"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
