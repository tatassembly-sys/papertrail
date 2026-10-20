import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  claimCronLockState,
  CRON_FETCH_LOCK_MS,
  PROCESS_QUEUE_LOCK_MS,
  releaseCronLockState,
} from "../lib/cron-lock";
import { canonicalSourceId } from "../lib/source-id";

test("source ids collapse arXiv versions and PubMed URLs", () => {
  assert.equal(canonicalSourceId({ externalId: "2401.12345v2" }), "2401.12345");
  assert.equal(
    canonicalSourceId({ sourceUrl: "https://arxiv.org/pdf/2401.12345v2" }),
    "2401.12345"
  );
  assert.equal(
    canonicalSourceId({ sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/424242/" }),
    "424242"
  );
  assert.equal(canonicalSourceId({ sourceUrl: "https://example.test/paper" }), null);
});

test("a cron lock is single-holder until it expires", () => {
  const now = Date.parse("2026-06-01T12:00:00.000Z");
  const first = claimCronLockState(null, now, 150_000, "worker-a");
  assert.equal(first.acquired, true);
  const second = claimCronLockState(first.state, now + 1, 150_000, "worker-b");
  assert.equal(second.acquired, false);
  assert.equal(second.state.owner, "worker-a");
  const released = releaseCronLockState(first.state, "worker-b", now + 2);
  assert.equal(released.owner, "worker-a");
  const freed = releaseCronLockState(first.state, "worker-a", now + 2);
  const third = claimCronLockState(freed, now + 2, 150_000, "worker-b");
  assert.equal(third.acquired, true);
  const expired = claimCronLockState(first.state, now + 150_000, 150_000, "worker-c");
  assert.equal(expired.acquired, true);
  assert.ok(PROCESS_QUEUE_LOCK_MS >= 120_000);
  assert.ok(CRON_FETCH_LOCK_MS >= 60_000);
});

test("cron-fetch and process-queue take the lock and key articles by source id", () => {
  const fetchSrc = readFileSync("app/api/cron-fetch/route.ts", "utf8");
  const queueSrc = readFileSync("app/api/process-queue/route.ts", "utf8");
  const indexSrc = readFileSync("lib/indexes.ts", "utf8");
  assert.match(fetchSrc, /acquireCronLock\("cron-fetch"/);
  assert.match(queueSrc, /acquireCronLock\("process-queue"/);
  assert.match(queueSrc, /sourceId: row\.external_id/);
  assert.match(indexSrc, /articles_source_id_unique/);
});
