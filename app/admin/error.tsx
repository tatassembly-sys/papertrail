"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-sm border border-danger/40 bg-redpen-soft p-6">
      <h2 className="mb-1 text-lg font-semibold text-ink">
        Something went wrong loading this page.
      </h2>
      <p className="mb-4 text-sm text-ink-soft">
        This admin view failed to load. Try again.
      </p>
      <button onClick={reset} className="pt-btn-ghost text-sm">
        Try again
      </button>
    </div>
  );
}
