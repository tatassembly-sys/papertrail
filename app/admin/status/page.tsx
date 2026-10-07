import { getAdminOpsStatus } from "@/lib/admin-status";
import GrantProForm from "@/components/GrantProForm";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-rule bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-stamp">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-ink">{value}</p>
    </div>
  );
}

export default async function AdminStatusPage() {
  let status: Awaited<ReturnType<typeof getAdminOpsStatus>> | null = null;
  let error: string | null = null;

  try {
    status = await getAdminOpsStatus();
  } catch (err) {
    error = err instanceof Error ? err.message : "Status unavailable.";
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink">Ops status</h1>

      {error && <p className="pt-alert-error">{error}</p>}

      {status && (
        <>
          {status.blockers.length > 0 && (
            <div className="mb-6 rounded-sm border border-redpen/40 bg-redpen-soft p-4 text-sm text-ink">
              <p className="font-mono text-xs uppercase tracking-widest text-redpen">
                Blockers
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {status.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="mb-4 text-sm text-ink-soft">
            Site URL: <span className="break-all text-ink">{status.siteUrl}</span>
            {" · "}
            Email: {status.email.mode}
            {" · "}
            Billing: {status.billing.mode}
            {" · "}
            OpenRouter: {status.openrouter.ok ? "ok" : "not ready"}
            {status.lastMix?.dateKey
              ? ` · Last daily mix ${String(status.lastMix.dateKey)} (${status.lastMix.published ?? 0})`
              : ""}
          </p>

          {status.queue.lastError ? (
            <p className="mb-4 break-words text-sm text-ink">
              <span className="font-mono text-[10px] uppercase tracking-widest text-redpen">
                Last queue error
              </span>
              <span className="mt-1 block">{status.queue.lastError}</span>
            </p>
          ) : null}

          <ul className="mb-6 divide-y divide-rule rounded-sm border border-rule bg-surface text-sm">
            {status.crons.map((run) => (
              <li key={run.job} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="font-mono text-xs uppercase tracking-wide text-ink">{run.job}</span>
                {run.status === null ? (
                  <span className="text-ink-soft">No run recorded</span>
                ) : (
                  <span className={run.ok ? "text-ink" : "text-redpen"}>
                    {run.ok ? "ok" : "failed"} {run.status}
                    {run.durationMs !== null ? ` · ${run.durationMs} ms` : ""}
                    {run.at ? ` · ${run.at}` : ""}
                    {run.error ? ` · ${run.error}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Published" value={status.articles.published} />
            <Stat label="Drafts" value={status.articles.drafts} />
            <Stat label="Queue pending" value={status.queue.pending} />
            <Stat label="Queue errors" value={status.queue.error} />
            <Stat label="Queue done" value={status.queue.done} />
            <Stat label="Suggestions" value={status.submissionsPending} />
            <Stat label="Newsletter active" value={status.newsletter.active} />
            <Stat label="Scheduled posts" value={status.scheduledPending} />
            <Stat label="Pro readers" value={status.billing.proUsers} />
            <Stat label="Lab enquiries" value={status.billing.inquiries} />
          </div>
          <GrantProForm />
        </>
      )}
    </div>
  );
}