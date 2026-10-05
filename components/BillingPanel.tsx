"use client";

import { useState } from "react";
import Link from "next/link";

interface BillingUser {
  plan: "free" | "pro";
  plan_status: string | null;
  plan_interval: "month" | "year" | null;
  plan_period_end: string | null;
  cancel_at_period_end: boolean;
  has_billing_customer?: boolean;
}

interface Usage {
  chatToday: number;
  chatLimit: number | null;
  saves: number;
  saveLimit: number | null;
  bookmarks: number;
  bookmarkLimit: number | null;
}

export default function BillingPanel({
  user,
  usage,
  configured,
  success,
  canceled,
}: {
  user: BillingUser;
  usage: Usage | null;
  configured: boolean;
  success?: boolean;
  canceled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pro = user.plan === "pro";

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.url !== "string") {
        setError(typeof body.error === "string" ? body.error : "Could not open billing.");
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stamp">
        Plan
      </h2>
      {success && (
        <p className="text-sm font-medium text-ink">Pro is active. Thank you.</p>
      )}
      {canceled && (
        <p className="text-sm text-ink-soft">Checkout canceled — you&apos;re still on Free.</p>
      )}
      <p className="text-base text-ink">
        {pro ? "Paper Trail Pro" : "Free"}
        {user.plan_interval ? ` · billed ${user.plan_interval}ly` : ""}
        {user.cancel_at_period_end && user.plan_period_end
          ? ` · ends ${new Date(user.plan_period_end).toLocaleDateString()}`
          : ""}
      </p>
      {usage && (
        <ul className="space-y-1 text-sm text-ink-soft">
          <li>
            Chat today:{" "}
            {usage.chatLimit == null
              ? "unlimited"
              : `${usage.chatToday} / ${usage.chatLimit}`}
          </li>
          <li>
            Saved papers:{" "}
            {usage.saveLimit == null ? usage.saves : `${usage.saves} / ${usage.saveLimit}`}
          </li>
          <li>
            Bookmarks:{" "}
            {usage.bookmarkLimit == null
              ? usage.bookmarks
              : `${usage.bookmarks} / ${usage.bookmarkLimit}`}
          </li>
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        {!pro && (
          <Link href="/pricing" className="pt-btn">
            Upgrade to Pro
          </Link>
        )}
        {pro && configured && user.has_billing_customer && (
          <button type="button" onClick={openPortal} disabled={busy} className="pt-btn-ghost">
            {busy ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>
      {error && <p className="pt-alert-error">{error}</p>}
    </section>
  );
}
