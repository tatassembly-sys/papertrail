export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-2 h-4 w-32 rounded bg-rule" />
      <div className="mb-6 h-8 w-56 rounded bg-rule" />
      <div className="mb-6 h-4 w-full max-w-md rounded bg-rule" />

      <div className="flex flex-col divide-y divide-rule rounded-sm border border-rule">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 w-3/4 rounded bg-rule" />
              <div className="mb-2 h-3 w-1/2 rounded bg-rule" />
              <div className="h-3 w-24 rounded bg-rule" />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="h-8 w-20 rounded-sm bg-rule" />
              <div className="h-4 w-14 rounded bg-rule" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
