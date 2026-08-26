export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-rule" />
        <div className="flex gap-3">
          <div className="h-9 w-28 rounded-sm bg-rule" />
          <div className="h-9 w-36 rounded-sm bg-rule" />
        </div>
      </div>

      <div className="mb-4 h-9 w-72 rounded-sm bg-rule" />

      <div className="mb-3 flex gap-4">
        <div className="h-4 w-10 rounded bg-rule" />
        <div className="h-4 w-14 rounded bg-rule" />
        <div className="h-4 w-16 rounded bg-rule" />
      </div>

      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-rule" />
        ))}
      </div>

      <div className="flex flex-col divide-y divide-rule rounded-sm border border-rule">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 w-2/3 rounded bg-rule" />
              <div className="h-3 w-1/2 rounded bg-rule" />
            </div>
            <div className="h-5 w-16 shrink-0 rounded-full bg-rule" />
          </div>
        ))}
      </div>
    </div>
  );
}
