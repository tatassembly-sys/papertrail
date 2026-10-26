import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CRON_JOBS, cronLogLine, latestCronByJob, redactCronNote } from "../lib/cron-run";

test("cron log line names the job, status, and duration", () => {
  assert.equal(cronLogLine("cron-fetch", 200, 42.2), "cron cron-fetch status=200 durationMs=42");
  assert.equal(cronLogLine("process-queue", 500, -5), "cron process-queue status=500 durationMs=0");
});

test("cron notes redact secrets and stay short", () => {
  const note = redactCronNote(
    "dial mongodb+srv://user:secret@cluster.example.net/papertrail Bearer sk-or-v1-abcdefghijklmnopqrstuvwxyz"
  );
  assert.ok(note);
  assert.equal(note?.includes("secret@"), false);
  assert.equal(note?.includes("sk-or-"), false);
  assert.match(note as string, /\[redacted\]/);
  assert.equal(redactCronNote("   "), null);
});

test("latest cron row wins per job and unknown jobs are dropped", () => {
  const rows = latestCronByJob([
    { job: "cron-fetch", status: 500, duration_ms: 10, ok: false, error: "feed down", at: "2026-10-01T00:00:00.000Z" },
    { job: "cron-fetch", status: 200, duration_ms: 20, ok: true, error: "stale", at: "2026-10-07T00:00:00.000Z" },
    { job: "not-a-job", status: 500, duration_ms: 1, ok: false, error: "nope", at: "2026-10-08T00:00:00.000Z" },
    { _id: "process-queue", status: 401, duration_ms: 3, ok: false, error: "Bearer sk-live-shouldnotappear", at: "2026-10-06T00:00:00.000Z" },
  ]);
  assert.deepEqual(
    rows.map((row) => row.job),
    [...CRON_JOBS]
  );
  const fetch = rows.find((row) => row.job === "cron-fetch");
  assert.equal(fetch?.status, 200);
  assert.equal(fetch?.durationMs, 20);
  assert.equal(fetch?.ok, true);
  assert.equal(fetch?.error, null);
  const queue = rows.find((row) => row.job === "process-queue");
  assert.equal(queue?.status, 401);
  assert.equal(queue?.error?.includes("sk-live-"), false);
  assert.match(queue?.error ?? "", /\[redacted\]/);
  const digest = rows.find((row) => row.job === "newsletter-digest");
  assert.equal(digest?.status, null);
  assert.equal(digest?.at, null);
});

test("admin status lists every cron job", () => {
  const lib = readFileSync("lib/admin-status.ts", "utf8");
  const page = readFileSync("app/admin/status/page.tsx", "utf8");
  assert.match(lib, /latestCronByJob/);
  assert.match(lib, /cron_runs/);
  assert.match(page, /status\.crons/);
  for (const job of CRON_JOBS) {
    assert.match(readFileSync("lib/cron-run.ts", "utf8"), new RegExp(job));
  }
});

import { isCronStale, CRON_CADENCE_MS } from "../lib/cron-run";

test("isCronStale: stale only past 2x cadence; null when never run", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const q = CRON_CADENCE_MS["process-queue"];
  assert.equal(isCronStale("process-queue", null, now), null);
  assert.equal(isCronStale("process-queue", "not a date", now), null);
  assert.equal(isCronStale("process-queue", new Date(now.getTime() - 2 * q), now), false);
  assert.equal(isCronStale("process-queue", new Date(now.getTime() - 2 * q - 1), now), true);
  const day = CRON_CADENCE_MS["cron-fetch"];
  assert.equal(isCronStale("cron-fetch", new Date(now.getTime() - 1.5 * day).toISOString(), now), false);
  assert.equal(isCronStale("cron-fetch", new Date(now.getTime() - 3 * day).toISOString(), now), true);
});

test("latestCronByJob marks stale runs", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const runs = latestCronByJob(
    [
      { job: "process-queue", status: 200, at: new Date("2026-10-26T11:55:00Z") },
      { job: "process-scheduled-posts", status: 200, at: new Date("2026-10-26T10:00:00Z") },
    ],
    now
  );
  const by = Object.fromEntries(runs.map((r) => [r.job, r.stale]));
  assert.equal(by["process-queue"], false);
  assert.equal(by["process-scheduled-posts"], true);
  assert.equal(by["cron-fetch"], null);
});
