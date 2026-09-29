"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WelcomeTopics({
  suggested,
  initial,
}: {
  suggested: string[];
  initial: string[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(tag: string) {
    setPicked((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 40)
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    const extra = custom
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const followed = [...new Set([...picked, ...extra])];
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followed_topics: followed }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save topics.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {suggested.map((tag) => {
          const on = picked.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
                on
                  ? "border-ink bg-ink text-paper"
                  : "border-rule bg-surface text-ink-soft hover:border-ink"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <label className="mt-5 block text-sm font-medium text-ink">
        Anything else? Comma-separated.
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="pt-input mt-1"
          placeholder="e.g. dementia, fusion, labour markets"
        />
      </label>
      {error && <p className="mt-2 pt-alert-error">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={busy} className="pt-btn">
          {busy ? "Saving…" : "Start reading"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="pt-btn-ghost"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
