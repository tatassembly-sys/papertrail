"use client";

import { useState } from "react";

export default function LabInquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [seats, setSeats] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/billing/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, org, seats, note, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error || "Could not send enquiry.");
        return;
      }
      setStatus("done");
      setMessage("Thanks — we'll reply if a lab plan is a fit.");
      setName("");
      setEmail("");
      setOrg("");
      setSeats("");
      setNote("");
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  if (status === "done") {
    return <p className="mt-4 text-sm text-ink">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className="text-sm font-medium text-ink">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="pt-input mt-1"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Work email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pt-input mt-1"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Organisation
        <input
          required
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className="pt-input mt-1"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Seats (optional)
        <input
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          className="pt-input mt-1"
          placeholder="e.g. 25"
        />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        What do you need?
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="pt-input mt-1 min-h-24"
        />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "loading"} className="pt-btn">
          {status === "loading" ? "Sending…" : "Request a lab quote"}
        </button>
        {message && status === "error" && (
          <p className="mt-2 pt-alert-error">{message}</p>
        )}
      </div>
    </form>
  );
}
