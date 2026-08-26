"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PublishMixButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/publish-mix", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Publish mix failed.");
        return;
      }
      if (body.skipped === "already_ran_today") {
        setMessage("Today's mix already ran.");
      } else {
        const n = typeof body.published === "number" ? body.published : 0;
        setMessage(`Published ${n} paper${n === 1 ? "" : "s"} across fields.`);
      }
      router.refresh();
    } catch {
      setError("Network error running the mix.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={busy} className="pt-btn-ghost">
        {busy ? "Publishing mix…" : "Publish today's mix"}
      </button>
      {message && <p className="text-xs text-success">{message}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
