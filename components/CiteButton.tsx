"use client";

import { useState } from "react";
import { CITE_STYLES, formatCitation, type CiteStyle } from "@/lib/cite";
import type { ArticleRow } from "@/lib/prompts";

export default function CiteButton({
  article,
  siteUrl,
}: {
  article: ArticleRow;
  siteUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<CiteStyle | null>(null);

  async function copy(style: CiteStyle) {
    const text = formatCitation(article, siteUrl, style);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(style);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-10 rounded-sm border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-ink"
        aria-expanded={open}
      >
        Cite
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-sm border border-rule bg-paper p-2 shadow-sm">
          <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wide text-stamp">
            Copy citation
          </p>
          {CITE_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => copy(s.id)}
              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-surface"
            >
              {copied === s.id ? "Copied" : s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
