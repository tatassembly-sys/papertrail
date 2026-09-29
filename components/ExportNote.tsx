"use client";

import { useState } from "react";
import Link from "next/link";

export default function ExportNote({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/export`);
      if (res.status === 401) {
        setMsg("Sign in to export.");
        setBusy(false);
        return;
      }
      if (res.status === 402) {
        setMsg("Markdown export is a Pro feature.");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        setMsg("Could not export this note.");
        setBusy(false);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${slug}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setMsg("Network error.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="text-sm font-medium text-ink-soft hover:text-redpen disabled:opacity-50"
      >
        {busy ? "Preparing…" : "Download markdown"}
      </button>
      {msg && (
        <p className="mt-1 text-sm text-ink-soft">
          {msg}{" "}
          {msg.includes("Pro") && (
            <Link href="/pricing" className="text-redpen hover:underline">
              See Pro →
            </Link>
          )}
          {msg.includes("Sign in") && (
            <Link href="/user-login?next=/pricing" className="text-redpen hover:underline">
              Sign in →
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
