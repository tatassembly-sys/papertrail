export default function Loading() {
  return (
    <div>
      <div className="mb-14 max-w-2xl animate-pulse">
        <div className="mb-3 h-3 w-40 rounded bg-rule" />
        <div className="h-10 w-3/4 rounded bg-rule" />
        <div className="mt-4 h-4 w-full rounded bg-rule" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-sm border border-rule p-5">
            <div className="mb-3 h-3 w-24 rounded bg-rule" />
            <div className="h-5 w-full rounded bg-rule" />
            <div className="mt-2 h-4 w-5/6 rounded bg-rule" />
          </div>
        ))}
      </div>
    </div>
  );
}
