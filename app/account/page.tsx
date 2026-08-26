"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  saved_slugs: string[];
  bookmarks: string[];
  followed_topics: string[];
  reading_history: { slug: string; at: string }[];
}

function AccountInner() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [topics, setTopics] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();
  const verified = sp.get("verified");
  const registered = sp.get("registered");

  async function load() {
    const d = await fetch("/api/me").then((r) => r.json());
    const raw = d?.user ?? null;
    const next = raw
      ? {
          ...raw,
          saved_slugs: raw.saved_slugs || [],
          bookmarks: raw.bookmarks || [],
          followed_topics: raw.followed_topics || [],
          reading_history: raw.reading_history || [],
        }
      : null;
    setUser(next);
    if (next) {
      setName(next.name || "");
      setTopics(next.followed_topics.join(", "));
    }
  }

  useEffect(() => {
    load().catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <p className="text-base text-ink-soft">Loading account…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Your account
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Sign in to save papers, bookmark favorites, follow topics, and keep a
          reading history.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/user-login"
            className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="pt-btn-ghost"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        followed_topics: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setSaveMsg("Could not save profile.");
      return;
    }
    const d = await res.json();
    setUser(d.user);
    setSaveMsg("Profile saved.");
  }

  async function logout() {
    await fetch("/api/auth/user-logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function removeSlug(slug: string, action: "save" | "bookmark") {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action }),
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
    }
  }

  const input = "pt-input";

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Hi, {user.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        {registered === "1" && (
          <p className="mt-2 text-sm text-ink-soft">Welcome — your account is ready.</p>
        )}
        {verified === "1" && (
          <p className="mt-2 text-sm font-medium text-redpen">Email verified.</p>
        )}
        {!user.email_verified && (
          <p className="mt-2 text-sm text-ink-soft">
            Email not verified yet. Use the verification link from registration
            (or server logs if email is not configured).
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
          Profile
        </h2>
        <label className="block text-sm font-medium text-ink">
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${input} mt-1`}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Followed topics
          <input
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            className={`${input} mt-1`}
            placeholder="e.g. AI, climate, dementia"
          />
          <span className="mt-1 block text-xs text-ink-soft">
            Comma-separated topics you care about.
          </span>
        </label>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="min-h-11 rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saveMsg && <p className="text-sm text-ink-soft">{saveMsg}</p>}
      </section>

      <SlugList
        title="Saved papers"
        empty="No saved papers yet. Open an article and click Save paper."
        slugs={user.saved_slugs}
        onRemove={(slug) => removeSlug(slug, "save")}
        removeLabel="Unsave"
      />

      <SlugList
        title="Bookmarks"
        empty="No bookmarks yet. Open an article and click Bookmark."
        slugs={user.bookmarks}
        onRemove={(slug) => removeSlug(slug, "bookmark")}
        removeLabel="Remove"
      />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
          Followed topics
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.followed_topics.length === 0 && (
            <p className="text-sm text-ink-soft">None yet — add some in your profile.</p>
          )}
          {user.followed_topics.map((t) => (
            <Link
              key={t}
              href={`/?q=${encodeURIComponent(t)}`}
              className="rounded-full border border-rule bg-surface px-3 py-1 text-sm text-ink hover:border-ink"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
          Reading history
        </h2>
        <ul className="mt-3 space-y-2">
          {user.reading_history.length === 0 && (
            <li className="text-sm text-ink-soft">
              Nothing yet — open any paper while signed in.
            </li>
          )}
          {user.reading_history.map((h) => (
            <li key={h.slug + h.at} className="flex flex-wrap items-baseline gap-2 text-sm">
              <Link href={`/posts/${h.slug}`} className="font-medium text-ink hover:text-redpen">
                {titleFromSlug(h.slug)}
              </Link>
              <span className="text-xs text-stamp">
                {new Date(h.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={logout}
        className="min-h-11 text-sm font-medium text-ink-soft hover:text-redpen"
      >
        Sign out
      </button>
    </div>
  );
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function SlugList({
  title,
  empty,
  slugs,
  onRemove,
  removeLabel,
}: {
  title: string;
  empty: string;
  slugs: string[];
  onRemove: (slug: string) => void;
  removeLabel: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {slugs.length === 0 && <li className="text-sm text-ink-soft">{empty}</li>}
        {slugs.map((s) => (
          <li
            key={s}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/60 pb-2"
          >
            <Link
              href={`/posts/${s}`}
              className="font-medium text-ink hover:text-redpen"
            >
              {titleFromSlug(s)}
            </Link>
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="text-xs text-stamp hover:text-redpen"
            >
              {removeLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-base text-ink-soft">Loading account…</p>}>
      <AccountInner />
    </Suspense>
  );
}
