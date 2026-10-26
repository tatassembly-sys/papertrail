import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/** Railway cron jobs, in the order they appear on /admin/status. */
export const CRON_JOBS = [
  "cron-fetch",
  "cron-fetch-pubmed",
  "process-queue",
  "process-scheduled-posts",
  "cron-publish-mix",
  "newsletter-digest",
] as const;

export type CronJobName = (typeof CRON_JOBS)[number];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Expected cadence per job (docs/runbooks/cron-job-org.md). */
export const CRON_CADENCE_MS: Record<CronJobName, number> = {
  "cron-fetch": DAY,
  "cron-fetch-pubmed": DAY,
  "process-queue": 10 * MINUTE,
  "process-scheduled-posts": 5 * MINUTE,
  "cron-publish-mix": DAY,
  "newsletter-digest": 7 * DAY,
};

/**
 * A job is stale when its last run is older than 2x its cadence.
 * Returns null when the job has never run (nothing to judge yet).
 */
export function isCronStale(
  job: CronJobName,
  at: string | Date | null,
  now: Date = new Date()
): boolean | null {
  if (!at) return null;
  const ms = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (!Number.isFinite(ms)) return null;
  return now.getTime() - ms > 2 * CRON_CADENCE_MS[job];
}

export interface CronRunView {
  job: CronJobName;
  status: number | null;
  durationMs: number | null;
  ok: boolean | null;
  error: string | null;
  at: string | null;
  /** True when the last run is older than 2x cadence; null if never run. */
  stale: boolean | null;
}

const MAX_NOTE = 160;

export function redactCronNote(message: string): string | null {
  const cleaned = message
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/([?&](?:key|token|secret|password)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= MAX_NOTE) return cleaned;
  return `${cleaned.slice(0, MAX_NOTE - 3)}...`;
}

export function cronLogLine(job: string, status: number, durationMs: number): string {
  const ms = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  return `cron ${job} status=${status} durationMs=${ms}`;
}

function isCronJob(value: string): value is CronJobName {
  return (CRON_JOBS as readonly string[]).includes(value);
}

function emptyRun(job: CronJobName): CronRunView {
  return { job, status: null, durationMs: null, ok: null, error: null, at: null, stale: null };
}

function rowTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

/** Newest stored row per known job. Jobs with no row stay empty. */
export function latestCronByJob(rows: unknown[], now: Date = new Date()): CronRunView[] {
  const newest = new Map<CronJobName, { atMs: number; view: CronRunView }>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const doc = row as Record<string, unknown>;
    const name = typeof doc.job === "string" ? doc.job : typeof doc._id === "string" ? doc._id : "";
    if (!isCronJob(name)) continue;
    const atMs = rowTime(doc.at);
    const previous = newest.get(name);
    if (previous && previous.atMs >= atMs) continue;
    const status = typeof doc.status === "number" && Number.isFinite(doc.status) ? doc.status : null;
    const durationMs =
      typeof doc.duration_ms === "number" && Number.isFinite(doc.duration_ms)
        ? Math.max(0, Math.round(doc.duration_ms))
        : null;
    const ok = typeof doc.ok === "boolean" ? doc.ok : status !== null ? status < 400 : null;
    const error =
      ok === false && typeof doc.error === "string" ? redactCronNote(doc.error) : null;
    const at = atMs > 0 ? new Date(atMs).toISOString() : null;
    newest.set(name, {
      atMs,
      view: { job: name, status, durationMs, ok, error, at, stale: isCronStale(name, at, now) },
    });
  }

  return CRON_JOBS.map((job) => newest.get(job)?.view ?? emptyRun(job));
}

async function noteFromResponse(response: NextResponse): Promise<{ ok: boolean; error: string | null }> {
  let ok = response.status < 400;
  let error: string | null = null;
  try {
    const data = (await response.clone().json()) as unknown;
    if (!data || typeof data !== "object") return { ok, error };
    const body = data as { success?: unknown; error?: unknown; message?: unknown };
    if (body.success === false) ok = false;
    const note =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : null;
    if (!ok && note) error = redactCronNote(note);
  } catch {
    /* non-JSON bodies still record status and duration */
  }
  return { ok, error };
}

async function persistCronRun(
  job: CronJobName,
  response: NextResponse,
  durationMs: number
): Promise<void> {
  const { ok, error } = await noteFromResponse(response);
  const ms = Math.max(0, Math.round(durationMs));
  console.info(cronLogLine(job, response.status, ms));
  try {
    const db = await getDb();
    await db.collection("cron_runs").insertOne({
      job,
      status: response.status,
      duration_ms: ms,
      ok,
      error,
      at: new Date(),
    });
  } catch (err) {
    console.error("cron run log failed:", err);
  }
}

/** Time an authorized cron handler. A log failure does not change the response. */
export async function runCronJob(
  job: CronJobName,
  work: () => Promise<NextResponse>
): Promise<NextResponse> {
  const started = Date.now();
  let response: NextResponse;
  try {
    response = await work();
  } catch (error) {
    console.error(`cron ${job} failed:`, error);
    response = NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
  await persistCronRun(job, response, Date.now() - started);
  return response;
}

/** Compact cron summary for /api/health: last run time, ok and staleness per job. */
export async function cronHealthSummary(): Promise<{
  cron_last_run: Record<string, { at: string | null; ok: boolean | null; stale: boolean | null }>;
  queue_depth: number;
}> {
  const db = await getDb();
  const [rows, queueDepth] = await Promise.all([
    db
      .collection("cron_runs")
      .aggregate([
        { $sort: { at: -1 } },
        { $group: { _id: "$job", status: { $first: "$status" }, ok: { $first: "$ok" }, at: { $first: "$at" } } },
      ])
      .toArray(),
    db.collection("fetch_queue").countDocuments({ status: "pending" }),
  ]);
  const cron_last_run: Record<string, { at: string | null; ok: boolean | null; stale: boolean | null }> = {};
  for (const run of latestCronByJob(rows)) {
    cron_last_run[run.job] = { at: run.at, ok: run.ok, stale: run.stale };
  }
  return { cron_last_run, queue_depth: queueDepth };
}
