"use client";

import { useEffect } from "react";

export default function Error({
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
    <div className="flex min-h-[50vh] flex-col items-start justify-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-redpen">
        Something went wrong
      </p>
      <h1 className="font-display text-3xl font-medium text-ink">
        This page hit a snag.
      </h1>
      <p className="mt-3 max-w-md text-ink-soft">
        It&apos;s not you — something failed loading this content. Try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 font-mono text-sm uppercase tracking-wide text-redpen hover:underline"
      >
        Try again →
      </button>
    </div>
  );
}
