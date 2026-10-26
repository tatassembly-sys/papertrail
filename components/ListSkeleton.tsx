/** Shared loading skeleton for public list pages (M9.1). */
export default function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-10 max-w-2xl animate-pulse">
        <div className="mb-3 h-3 w-40 rounded bg-rule" />
        <div className="h-9 w-2/3 rounded bg-rule" />
      </div>
      <ul className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="animate-pulse rounded-sm border border-rule p-5">
            <div className="mb-3 h-3 w-24 rounded bg-rule" />
            <div className="h-5 w-full rounded bg-rule" />
            <div className="mt-2 h-4 w-5/6 rounded bg-rule" />
          </li>
        ))}
      </ul>
    </div>
  );
}
