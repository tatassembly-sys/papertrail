import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-start justify-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        404 · not on file
      </p>
      <h1 className="font-display text-3xl font-medium text-ink">
        This entry doesn&apos;t exist.
      </h1>
      <p className="mt-3 max-w-md text-ink-soft">
        The paper you&apos;re looking for was never filed, or the link is out of date.
      </p>
      <Link
        href="/"
        className="mt-6 font-mono text-sm uppercase tracking-wide text-redpen hover:underline"
      >
        ← Back to all entries
      </Link>
    </div>
  );
}
