export default function PostLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-3 w-28 rounded-sm bg-rule" />
      <div className="h-3 w-24 rounded-sm bg-rule" />
      <div className="mt-4 h-10 w-4/5 rounded-sm bg-rule" />
      <div className="mt-3 h-5 w-full rounded-sm bg-rule" />
      <div className="mt-2 h-5 w-2/3 rounded-sm bg-rule" />
      <div className="mt-8 h-3 w-32 rounded-sm bg-rule" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded-sm bg-rule" />
        <div className="h-4 w-full rounded-sm bg-rule" />
        <div className="h-4 w-5/6 rounded-sm bg-rule" />
      </div>
      <div className="mt-10 h-3 w-28 rounded-sm bg-rule" />
      <div className="mt-4 h-24 w-full rounded-sm bg-rule" />
    </div>
  );
}
