"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutButtons({
  configured,
  monthlyLabel,
  yearlyLabel,
  signedIn,
}: {
  configured: boolean;
  monthlyLabel: string;
  yearlyLabel: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"month" | "year" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(interval: "month" | "year") {
    setError(null);
    if (!signedIn) {
      router.push("/user-login?next=/pricing");
      return;
    }
    if (!configured) {
      setError("Checkout is not live yet. The owner still needs to add Stripe keys.");
      return;
    }
    setBusy(interval);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push("/user-login?next=/pricing");
        return;
      }
      if (!res.ok || typeof body.url !== "string") {
        setError(typeof body.error === "string" ? body.error : "Could not start checkout.");
        setBusy(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error — try again.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => start("month")}
          className="pt-btn flex-1"
        >
          {busy === "month" ? "Redirecting…" : `Subscribe ${monthlyLabel}/month`}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => start("year")}
          className="pt-btn-ghost flex-1"
        >
          {busy === "year" ? "Redirecting…" : `Subscribe ${yearlyLabel}/year`}
        </button>
      </div>
      {!signedIn && (
        <p className="text-sm text-ink-soft">
          You&apos;ll sign in first — then Stripe handles the card.
        </p>
      )}
      {!configured && (
        <p className="text-sm text-ink-soft">
          Payments are wired in the product but Stripe is not configured on this
          server yet. Reading stays free.
        </p>
      )}
      {error && (
        <p className="pt-alert-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
