"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArticleRow } from "@/lib/prompts";
import type { ScheduledPostRow } from "@/lib/scheduledPosts";
import { ARXIV_CATEGORY_CODES, categoryLabel } from "@/lib/arxivCategories";
import ShareSection from "./ShareSection";

export default function EditorForm({
  article,
  initialScheduled = [],
}: {
  article: ArticleRow;
  initialScheduled?: ScheduledPostRow[];
}) {
  const [form, setForm] = useState({
    title: article.title,
    headline: article.headline,
    why_it_matters: article.why_it_matters.join("\n"),
    plain_explanation: article.plain_explanation,
    caveats: article.caveats,
    slug: article.slug,
    source_url: article.source_url || "",
    category: article.category || "",
    authors: (article.authors || []).join("\n"),
    institutions: (article.institutions || []).join("\n"),
    keywords: (article.keywords || []).join("\n"),
    tags: (article.tags || []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareApproved, setShareApproved] = useState(Boolean(article.share_approved));
  const [shareBusy, setShareBusy] = useState(false);

  const router = useRouter();

  async function toggleShareApproval() {
    setShareBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/approve-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !shareApproved }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not update share approval.");
        setShareBusy(false);
        return;
      }
      setShareApproved(Boolean(body.share_approved));
      setMessage(
        body.share_approved
          ? "Social sharing approved for this article."
          : "Social sharing approval revoked."
      );
      router.refresh();
    } catch {
      setError("Network error updating share approval.");
    }
    setShareBusy(false);
  }

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(status?: "draft" | "published") {
    setError(null);
    setMessage(null);

    if (status === "published" && !form.source_url.trim()) {
      setError(
        "A source URL is required before publishing — every article must link back to the original paper."
      );
      return;
    }

    setSaving(true);

    const lines = (value: string) =>
      value
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

    const payload: Record<string, unknown> = {
      title: form.title,
      headline: form.headline,
      why_it_matters: form.why_it_matters
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      plain_explanation: form.plain_explanation,
      caveats: form.caveats,
      slug: form.slug,
      source_url: form.source_url.trim() || null,
      category: form.category || null,
      authors: lines(form.authors),
      institutions: lines(form.institutions),
      keywords: lines(form.keywords),
      tags: lines(form.tags),
    };
    if (status) payload.status = status;

    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to save.");
      return;
    }

    if (status === "published") {
      router.push("/admin");
      router.refresh();
    } else {
      setMessage("Saved.");
      router.refresh();
    }
  }

  async function handleDelete() {
    const confirmMessage =
      article.status === "draft"
        ? "Discard this draft? This can't be undone."
        : "Delete this published article permanently?";
    if (!confirm(confirmMessage)) return;
    const res = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Title</label>
        <input
          className="pt-input"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Slug</label>
        <input
          className="pt-input"
          value={form.slug}
          onChange={(e) => update("slug", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Source URL <span className="font-normal text-stamp">(required to publish)</span>
        </label>
        <input
          className="pt-input"
          value={form.source_url}
          onChange={(e) => update("source_url", e.target.value)}
          placeholder="https://arxiv.org/abs/2401.12345"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Category{" "}
          <span className="font-normal text-stamp">(controls homepage filtering)</span>
        </label>
        <select
          className="pt-input"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">Uncategorized</option>
          {ARXIV_CATEGORY_CODES.map((code) => (
            <option key={code} value={code}>
              {categoryLabel(code)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Headline</label>
        <input
          className="pt-input"
          value={form.headline}
          onChange={(e) => update("headline", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Why it matters (one point per line)
        </label>
        <textarea
          className="pt-input"
          rows={3}
          value={form.why_it_matters}
          onChange={(e) => update("why_it_matters", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Plain explanation</label>
        <textarea
          className="pt-input"
          rows={12}
          value={form.plain_explanation}
          onChange={(e) => update("plain_explanation", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Caveats</label>
        <textarea
          className="pt-input"
          rows={4}
          value={form.caveats}
          onChange={(e) => update("caveats", e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Authors <span className="font-normal text-stamp">(one per line)</span>
          </label>
          <textarea
            className="pt-input"
            rows={3}
            value={form.authors}
            onChange={(e) => update("authors", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Institutions <span className="font-normal text-stamp">(one per line)</span>
          </label>
          <textarea
            className="pt-input"
            rows={3}
            value={form.institutions}
            onChange={(e) => update("institutions", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Keywords <span className="font-normal text-stamp">(comma or line)</span>
          </label>
          <textarea
            className="pt-input"
            rows={3}
            value={form.keywords}
            onChange={(e) => update("keywords", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Tags <span className="font-normal text-stamp">(comma or line)</span>
          </label>
          <textarea
            className="pt-input"
            rows={3}
            value={form.tags}
            onChange={(e) => update("tags", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="pt-alert-error">{error}</p>}
      {message && <p className="pt-alert-success">{message}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button onClick={() => save()} disabled={saving} className="pt-btn-ghost">
          Save draft
        </button>
        <button onClick={() => save("published")} disabled={saving} className="pt-btn">
          {article.status === "published" ? "Update & keep published" : "Publish"}
        </button>
        <button
          onClick={handleDelete}
          className="ml-auto rounded-sm px-4 py-2 text-sm font-medium text-danger hover:bg-redpen-soft"
        >
          {article.status === "draft" ? "Discard draft" : "Delete"}
        </button>
      </div>

      {article.status === "published" && (
        <div className="space-y-4">
          <div className="pt-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Social share approval</h3>
              <p className="mt-1 text-xs text-ink-soft">
                API posts (Facebook, Instagram, Reddit) and scheduled posts only run after
                approval. Public share links still work.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleShareApproval}
              disabled={shareBusy}
              className={
                shareApproved
                  ? "pt-btn-ghost border-success text-success"
                  : "pt-btn"
              }
            >
              {shareBusy
                ? "Updating…"
                : shareApproved
                  ? "Approved ✓ (click to revoke)"
                  : "Approve for social"}
            </button>
          </div>
          <ShareSection
            article={{ ...article, share_approved: shareApproved }}
            initialScheduled={initialScheduled}
          />
        </div>
      )}
    </div>
  );
}
