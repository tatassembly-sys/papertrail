"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminListItem {
  id: string;
  title: string;
  subtitle: string;
  status: "draft" | "published";
  llmLabel: string;
}

/** Admin article list with draft checkboxes and bulk publish/reject (M9.3). */
export default function AdminArticleList({ items }: { items: AdminListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const drafts = items.filter((i) => i.status === "draft");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: "publish" | "reject") {
    if (selected.size === 0) return;
    if (action === "reject" && !window.confirm(`Delete ${selected.size} draft(s)? This cannot be undone.`)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(body.error || "Bulk update failed.");
        return;
      }
      const failed = (body.results || []).filter((r: { ok: boolean }) => !r.ok) as { id: string; error?: string }[];
      setNote(
        `${body.done ?? 0} ${action === "publish" ? "published" : "rejected"}` +
          (failed.length ? `, ${failed.length} skipped (${failed.map((f) => f.error).filter(Boolean).slice(0, 2).join("; ")})` : "")
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {drafts.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size === drafts.length}
              onChange={(e) => setSelected(e.target.checked ? new Set(drafts.map((d) => d.id)) : new Set())}
            />
            Select all drafts on this page
          </label>
          <button type="button" className="pt-btn" disabled={busy || selected.size === 0} onClick={() => run("publish")}>
            Approve {selected.size || ""}
          </button>
          <button type="button" className="pt-btn" disabled={busy || selected.size === 0} onClick={() => run("reject")}>
            Reject {selected.size || ""}
          </button>
          {note ? <span role="status" className="text-ink-soft">{note}</span> : null}
        </div>
      )}
      <div className="flex flex-col divide-y divide-rule rounded-sm border border-rule bg-surface">
        {items.map((article) => (
          <div key={article.id} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
            {article.status === "draft" ? (
              <input
                type="checkbox"
                aria-label={`Select ${article.title}`}
                checked={selected.has(article.id)}
                onChange={() => toggle(article.id)}
              />
            ) : (
              <span className="inline-block w-[13px]" aria-hidden />
            )}
            <Link href={`/admin/${article.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{article.title}</p>
                <p className="truncate text-sm text-ink-soft">{article.subtitle}</p>
                <p className="truncate font-mono text-[11px] text-stamp">{article.llmLabel}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  article.status === "published" ? "bg-success/15 text-success" : "bg-redpen-soft text-ink"
                }`}
              >
                {article.status}
              </span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
