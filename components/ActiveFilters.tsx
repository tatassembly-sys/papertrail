import type { ReactNode } from "react";
import Link from "next/link";
import {
  buildSearchHref,
  type SearchFilters,
} from "@/lib/search";
import { categoryLabel } from "@/lib/arxivCategories";

function chip(label: string, href: string) {
  return (
    <Link
      key={label + href}
      href={href}
      className="inline-flex min-h-9 items-center rounded-full border border-ink bg-ink px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-paper hover:opacity-90"
    >
      {label}
      <span className="ml-2 opacity-70" aria-hidden>
        ×
      </span>
    </Link>
  );
}

export default function ActiveFilters({ filters }: { filters: SearchFilters }) {
  const chips: ReactNode[] = [];

  if (filters.query) {
    chips.push(
      chip(`Search: ${filters.query}`, buildSearchHref("/", { ...filters, query: undefined, page: 1 }))
    );
  }
  if (filters.author) {
    chips.push(
      chip(`Author: ${filters.author}`, buildSearchHref("/", { ...filters, author: undefined, page: 1 }))
    );
  }
  if (filters.institution) {
    chips.push(
      chip(
        `Institution: ${filters.institution}`,
        buildSearchHref("/", { ...filters, institution: undefined, page: 1 })
      )
    );
  }
  if (filters.tag) {
    chips.push(
      chip(`Tag: ${filters.tag}`, buildSearchHref("/", { ...filters, tag: undefined, page: 1 }))
    );
  }
  if (filters.source) {
    chips.push(
      chip(`Source: ${filters.source}`, buildSearchHref("/", { ...filters, source: "", page: 1 }))
    );
  }
  if (filters.from || filters.to) {
    chips.push(
      chip(
        `Dates: ${filters.from || "…"} – ${filters.to || "…"}`,
        buildSearchHref("/", { ...filters, from: undefined, to: undefined, page: 1 })
      )
    );
  }

  if (chips.length === 0 && !filters.sort) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips}
      {filters.sort && filters.sort !== "newest" && (
        <Link
          href={buildSearchHref("/", { ...filters, sort: undefined, page: 1 })}
          className="inline-flex min-h-9 items-center rounded-full border border-rule px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-ink"
        >
          Sort: {filters.sort} ×
        </Link>
      )}
      {filters.category && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-stamp">
          in {categoryLabel(filters.category)}
        </span>
      )}
      {chips.length > 0 && (
        <Link href="/" className="font-mono text-[11px] uppercase tracking-wide text-redpen hover:underline">
          Clear all
        </Link>
      )}
    </div>
  );
}
