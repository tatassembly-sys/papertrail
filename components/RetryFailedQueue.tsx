"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin: put every failed queue row back to pending (M9.3). */
export default function RetryFailedQueue({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (count <= 0) return null;
  async function retry() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/queue/retry", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => ({}));
      setNote(res.ok ? `Retrying ${body.retried ?? 0} item(s).` : body.error || "Retry failed.");
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <p className="mb-4 text-sm">
      <button type="button" onClick={retry} disabled={busy} className="pt-btn">
        {busy ? "Retrying…" : `Retry ${count} failed queue item(s)`}
      </button>
      {note ? <span role="status" className="ml-3 text-ink-soft">{note}</span> : null}
    </p>
  );
}
