import Link from "next/link";
import { getSubmissions } from "@/lib/submissions";
import DismissButton from "@/components/DismissButton";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  let submissions: Awaited<ReturnType<typeof getSubmissions>> = [];
  let loadError: string | null = null;

  try {
    submissions = await getSubmissions("pending");
  } catch (error) {
    console.error("Failed to load submissions:", error);
    loadError = "Could not load suggestions right now. Try again shortly.";
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-block text-sm text-ink-soft hover:text-ink hover:underline"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Suggested papers</h1>
        </div>
      </div>

      <p className="mb-6 text-sm text-ink-soft">
        Suggestions from visitors at{" "}
        <code className="rounded bg-surface px-1 text-ink">/submit</code>. Nothing here has been
        translated or published — pick one to process, or dismiss it.
      </p>

      {loadError && <p className="pt-alert-error">{loadError}</p>}

      {!loadError && submissions.length === 0 && (
        <p className="text-ink-soft">No pending suggestions right now.</p>
      )}

      {submissions.length > 0 && (
        <div className="flex flex-col divide-y divide-rule rounded-sm border border-rule bg-surface">
          {submissions.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-medium text-ink hover:text-redpen hover:underline"
                >
                  {s.url}
                </a>
                {s.note && <p className="mt-1 text-sm text-ink-soft">&ldquo;{s.note}&rdquo;</p>}
                <p className="mt-1 text-xs text-stamp">
                  {new Date(s.submitted_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/admin/manual-input?url=${encodeURIComponent(s.url)}&submissionId=${s.id}`}
                  className="pt-btn px-3 py-1.5 text-sm"
                >
                  Process
                </Link>
                <DismissButton submissionId={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
