"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  slugs: string[];
}

export default function CollectionSave({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [lists, setLists] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  async function load() {
    const me = await fetch("/api/me").then((r) => r.json()).catch(() => ({}));
    if (!me?.user) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const d = await fetch("/api/collections").then((r) => r.json()).catch(() => ({}));
    setLists(Array.isArray(d.collections) ? d.collections : []);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function addTo(id: string) {
    setMsg(null);
    setUpgrade(false);
    const res = await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSlug: slug }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || "Could not add.");
      setUpgrade(body.code === "upgrade_required");
      return;
    }
    setLists((prev) =>
      prev.map((c) => (c.id === id ? { ...c, slugs: body.collection.slugs } : c))
    );
    setMsg("Added to list.");
  }

  async function create() {
    setMsg(null);
    setUpgrade(false);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Reading list" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || "Could not create list.");
      setUpgrade(body.code === "upgrade_required");
      return;
    }
    setName("");
    const created = body.collection as Collection;
    setLists((prev) => [created, ...prev]);
    await addTo(created.id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-10 rounded-sm border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-ink"
      >
        Add to list
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-sm border border-rule bg-paper p-3 shadow-sm">
          {signedIn === false && (
            <p className="text-sm text-ink-soft">
              <Link href="/user-login?next=/library" className="text-redpen hover:underline">
                Sign in
              </Link>{" "}
              to keep reading lists.
            </p>
          )}
          {signedIn && (
            <>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {lists.length === 0 && (
                  <li className="text-sm text-ink-soft">No lists yet.</li>
                )}
                {lists.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => addTo(c.id)}
                      className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface"
                    >
                      {c.name}
                      {c.slugs.includes(slug) ? " ✓" : ""}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New list name"
                  className="pt-input min-h-9 flex-1 py-1 text-sm"
                />
                <button type="button" onClick={create} className="pt-btn min-h-9 px-3 py-1 text-sm">
                  Create
                </button>
              </div>
            </>
          )}
          {msg && (
            <p className="mt-2 text-xs text-ink-soft">
              {msg}{" "}
              {upgrade && (
                <Link href="/pricing" className="text-redpen hover:underline">
                  See Pro
                </Link>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
