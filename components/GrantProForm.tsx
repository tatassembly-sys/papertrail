"use client";

import { useState } from "react";

export default function GrantProForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function grant(plan: "pro" | "free") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/billing/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body.error || "Could not update plan.");
      } else {
        setMsg(
          plan === "pro"
            ? `Pro granted to ${body.user?.email || email}.`
            : `Override cleared for ${body.user?.email || email}.`
        );
      }
    } catch {
      setMsg("Network error.");
    }
    setBusy(false);
  }

  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-sm border border-rule bg-surface p-4 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        grant("pro");
      }}
    >
      <label className="flex-1 text-sm font-medium text-ink">
        Comp Pro (email)
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pt-input mt-1"
          placeholder="reader@example.com"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="pt-btn">
          Grant Pro
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => grant("free")}
          className="pt-btn-ghost"
        >
          Revoke
        </button>
      </div>
      {msg && <p className="w-full text-sm text-ink-soft">{msg}</p>}
    </form>
  );
}
