"use client";

import { useState } from "react";
import type { ArticleRow } from "@/lib/prompts";
import { buildShareLinks } from "@/lib/share-links";
import type { ScheduledPostRow } from "@/lib/scheduledPosts";

interface ShareResult {
  platform: string;
  success: boolean;
  error?: string;
  postUrl?: string;
}

const API_PLATFORMS = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "reddit", label: "Reddit" },
] as const;

function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ShareSection({
  article,
  initialScheduled,
}: {
  article: ArticleRow;
  initialScheduled: ScheduledPostRow[];
}) {
  const [sharedTo, setSharedTo] = useState<string[]>(article.shared_to || []);
  const [posting, setPosting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ShareResult>>({});
  const [scheduled, setScheduled] = useState<ScheduledPostRow[]>(initialScheduled);
  const [schedulePlatform, setSchedulePlatform] = useState<string>(API_PLATFORMS[0].key);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const shareLinks = buildShareLinks(article, siteUrl);

  async function postTo(platform: string) {
    setPosting(platform);
    const res = await fetch(`/api/articles/${article.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms: [platform] }),
    });
    const body = await res.json().catch(() => ({ results: [] }));
    setPosting(null);

    const result: ShareResult | undefined = body.results?.[0];
    if (result) {
      setResults((prev) => ({ ...prev, [platform]: result }));
      if (result.success) setSharedTo((prev) => [...new Set([...prev, platform])]);
      return;
    }
    setResults((prev) => ({
      ...prev,
      [platform]: {
        platform,
        success: false,
        error: typeof body.error === "string" ? body.error : "Share failed.",
      },
    }));
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleError(null);

    if (!scheduleTime) {
      setScheduleError("Pick a date and time.");
      return;
    }

    setScheduling(true);
    const res = await fetch(`/api/articles/${article.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: schedulePlatform,
        scheduledFor: new Date(scheduleTime).toISOString(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setScheduling(false);

    if (!res.ok) {
      setScheduleError(body.error || "Failed to schedule.");
      return;
    }

    setScheduled((prev) =>
      [...prev, body.scheduled].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
    );
    setScheduleTime("");
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setScheduled((prev) => prev.filter((s) => s.id !== id));
    }
  }

  const approved = Boolean(article.share_approved);

  return (
    <div className="pt-card p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink">Share this article</h3>
      <p className="mb-4 text-xs text-ink-soft">
        X uses a free pre-filled share link (X&apos;s API now charges per post). Facebook,
        Instagram, and Reddit post directly if you&apos;ve configured credentials in{" "}
        <code className="rounded bg-paper px-1 text-ink">SETUP.md</code>
        {approved
          ? "."
          : " — and only after you approve social sharing above."}
      </p>

      <div className="mb-4">
        <a
          href={shareLinks.x}
          target="_blank"
          rel="noopener noreferrer"
          className="pt-btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          Share to X (free) →
        </a>
      </div>

      {!approved && (
        <p className="mb-3 text-xs text-stamp">
          API posting is locked until social share is approved.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {API_PLATFORMS.map(({ key, label }) => {
          const alreadyShared = sharedTo.includes(key);
          const result = results[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <button
                onClick={() => postTo(key)}
                disabled={!approved || posting === key}
                className="pt-btn-ghost px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {posting === key
                  ? "Posting…"
                  : alreadyShared
                    ? `Post to ${label} again`
                    : `Post to ${label}`}
              </button>
              {alreadyShared && !result && (
                <span className="text-xs text-success">✓ already posted</span>
              )}
              {result?.success && <span className="text-xs text-success">✓ posted</span>}
              {result && !result.success && (
                <span className="text-xs text-danger">{result.error}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stamp">
          Schedule for later
        </h4>

        <form onSubmit={handleSchedule} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-stamp">Platform</label>
            <select
              value={schedulePlatform}
              onChange={(e) => setSchedulePlatform(e.target.value)}
              className="rounded-sm border border-rule bg-surface px-2 py-1.5 text-sm text-ink"
            >
              {API_PLATFORMS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-stamp">Date &amp; time</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="rounded-sm border border-rule bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </div>

          <button
            type="submit"
            disabled={!approved || scheduling}
            className="pt-btn px-3 py-1.5 text-sm"
          >
            {scheduling ? "Scheduling…" : "Schedule"}
          </button>
        </form>
        {scheduleError && <p className="mt-2 pt-alert-error text-xs">{scheduleError}</p>}

        {scheduled.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {scheduled.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-sm border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <span>
                  <span className="font-medium capitalize">{s.platform}</span>{" "}
                  <span className="text-ink-soft">
                    — {formatScheduledTime(s.scheduled_for)}
                    {s.status === "processing" && " (posting now…)"}
                  </span>
                </span>
                {s.status === "pending" && (
                  <button
                    onClick={() => handleCancel(s.id)}
                    className="text-xs text-danger hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
