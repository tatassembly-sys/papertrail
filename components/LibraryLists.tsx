"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  description: string;
  slugs: string[];
  public: boolean;
}

export default function LibraryLists({
  titles,
}: {
  titles: Record<string, string>;
}) {
  const [lists, setLists] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  async function load() {
    const d = await fetch("/api/collections").then((r) => r.json()).catch(() => ({}));
    setLists(Array.isArray(d.collections) ? d.collections : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setUpgrade(false);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || "Could not create.");
      setUpgrade(body.code === "upgrade_required");
      return;
    }
    setName("");
    setMsg(null);
    await load();
  }

  async function togglePublic(id: string, next: boolean) {
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public: next }),
    });
    await load();
  }

  async function removeSlug(id: string, slug: string) {
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeSlug: slug }),
    });
    await load();
  }

  async function destroy(id: string) {
    if (!confirm("Delete this list?")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
        Reading lists
      </h2>
      <p className="text-sm text-ink-soft">
        Zotero folders / Semantic Scholar library. Free accounts get one list;
        Pro is unlimited. Make a list public to share a link.
      </p>
      <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="pt-input flex-1"
          placeholder="e.g. Climate week"
          required
        />
        <button type="submit" className="pt-btn">
          New list
        </button>
      </form>
      {msg && (
        <p className="text-sm text-ink-soft">
          {msg}{" "}
          {upgrade && (
            <Link href="/pricing" className="text-redpen hover:underline">
              See Pro
            </Link>
          )}
        </p>
      )}
      {lists.length === 0 && <p className="text-sm text-ink-soft">No lists yet.</p>}
      {lists.map((c) => (
        <div key={c.id} className="rounded-sm border border-rule bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-ink">{c.name}</h3>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => togglePublic(c.id, !c.public)}
                className="text-stamp hover:text-redpen"
              >
                {c.public ? "Make private" : "Make public"}
              </button>
              {c.public && (
                <Link href={`/lists/${c.id}`} className="text-redpen hover:underline">
                  Share link
                </Link>
              )}
              <button
                type="button"
                onClick={() => destroy(c.id)}
                className="text-stamp hover:text-redpen"
              >
                Delete
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-1">
            {c.slugs.length === 0 && (
              <li className="text-sm text-ink-soft">Empty — add papers from an article.</li>
            )}
            {c.slugs.map((s) => (
              <li key={s} className="flex justify-between gap-2 text-sm">
                <Link href={`/posts/${s}`} className="text-ink hover:text-redpen">
                  {titles[s] || s}
                </Link>
                <button
                  type="button"
                  onClick={() => removeSlug(c.id, s)}
                  className="text-xs text-stamp hover:text-redpen"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
