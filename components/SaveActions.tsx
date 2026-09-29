"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserState {
  saved_slugs: string[];
  bookmarks: string[];
}

export default function SaveActions({ slug }: { slug: string }) {
  const [user, setUser] = useState<UserState | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, []);

  async function toggle(action: "save" | "bookmark") {
    if (!user) return;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body.error || "Could not update.");
        setBusy(null);
        return;
      }
      setUser(body.user);
    } catch {
      setMsg("Network error.");
    }
    setBusy(null);
  }

  if (user === undefined) {
    return (
      <p className="mt-6 font-mono text-xs text-stamp" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/user-login" className="font-medium text-redpen hover:underline">
          Sign in
        </Link>{" "}
        to save papers and track reading history.
      </p>
    );
  }

  const saved = user.saved_slugs?.includes(slug);
  const bookmarked = user.bookmarks?.includes(slug);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-rule pt-5">
      <button
        type="button"
        disabled={busy === "save"}
        onClick={() => toggle("save")}
        className={`min-h-10 rounded-sm border px-4 py-2 text-sm font-medium transition ${
          saved
            ? "border-ink bg-ink text-paper"
            : "border-rule bg-surface text-ink hover:border-ink"
        }`}
      >
        {saved ? "Saved ✓" : "Save paper"}
      </button>
      <button
        type="button"
        disabled={busy === "bookmark"}
        onClick={() => toggle("bookmark")}
        className={`min-h-10 rounded-sm border px-4 py-2 text-sm font-medium transition ${
          bookmarked
            ? "border-redpen bg-redpen-soft text-ink"
            : "border-rule bg-surface text-ink hover:border-ink"
        }`}
      >
        {bookmarked ? "Bookmarked ✓" : "Bookmark"}
      </button>
      <Link href="/account" className="min-h-10 px-2 py-2 text-sm text-ink-soft hover:text-redpen">
        Account →
      </Link>
      {msg && (
        <p className="w-full pt-alert-error">
          {msg}{" "}
          {/upgrade|Pro/i.test(msg) && (
            <Link href="/pricing" className="underline">
              See Pro
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
