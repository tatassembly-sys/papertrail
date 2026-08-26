"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DismissButton({ submissionId }: { submissionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDismiss() {
    setLoading(true);
    const res = await fetch(`/api/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={loading}
      className="text-sm text-stamp hover:text-danger disabled:opacity-50"
    >
      {loading ? "…" : "Dismiss"}
    </button>
  );
}
