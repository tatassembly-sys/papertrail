"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  slug: string;
  title: string;
  headline: string;
  category: string | null;
}

/**
 * Simple search — category pills stay on the homepage.
 * Suggestions pop in as the user types (e.g. "tech" → tech papers).
 */
export default function SearchBar({
  initialQuery = "",
  preserve,
}: {
  initialQuery?: string;
  preserve?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#search") {
      wrapRef.current?.querySelector("input")?.focus();
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        const body = await res.json().catch(() => ({ suggestions: [] }));
        if (!ac.signal.aborted) {
          const next = Array.isArray(body.suggestions) ? body.suggestions : [];
          setSuggestions(next);
          setOpen(next.length > 0);
          setActive(-1);
        }
      } catch {
        if (!ac.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goTo(slug: string) {
    setOpen(false);
    router.push(`/posts/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      goTo(suggestions[active].slug);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form
      ref={wrapRef}
      action="/"
      method="GET"
      id="search"
      className="relative mb-6 w-full max-w-xl sm:mb-8"
      role="search"
    >
      {preserve &&
        Object.entries(preserve).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Try tech, space, health, math…  (press / )"
            autoComplete="off"
            data-search-input="true"
            className="pt-input w-full"
            aria-label="Search papers"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            role="combobox"
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-sm border border-rule bg-surface shadow-md"
            >
              {suggestions.map((s, i) => (
                <li key={s.slug} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(s.slug)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left ${
                      i === active ? "bg-redpen-soft" : "hover:bg-paper"
                    }`}
                  >
                    <span className="text-sm font-medium text-ink">{s.title}</span>
                    <span className="line-clamp-1 text-xs text-ink-soft">
                      {s.category ? `${s.category} · ` : ""}
                      {s.headline}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="pt-btn sm:px-6">
          {loading ? "…" : "Search"}
        </button>
      </div>
    </form>
  );
}