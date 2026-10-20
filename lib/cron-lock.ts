import { randomBytes } from "crypto";
import { getDb } from "./mongodb";

/** Longer than the route maxDuration so a crashed worker cannot overlap the next claim. */
export const CRON_FETCH_LOCK_MS = 90_000;
export const PROCESS_QUEUE_LOCK_MS = 150_000;

export interface CronLockState {
  owner: string | null;
  lockedUntil: number;
}

/**
 * One holder at a time. An expired lock can be taken again.
 * The Mongo update below applies the same rule atomically.
 */
export function claimCronLockState(
  current: CronLockState | null,
  now: number,
  ttlMs: number,
  owner: string
): { state: CronLockState; acquired: boolean } {
  if (current?.owner && current.lockedUntil > now) {
    return { state: current, acquired: false };
  }
  return {
    acquired: true,
    state: { owner, lockedUntil: now + ttlMs },
  };
}

export function releaseCronLockState(
  current: CronLockState,
  owner: string,
  now: number
): CronLockState {
  if (current.owner !== owner) return current;
  return { owner: null, lockedUntil: now };
}

interface CronLockDoc {
  _id: string;
  owner: string | null;
  locked_until: Date;
}

export async function acquireCronLock(
  job: string,
  ttlMs: number,
  now = new Date()
): Promise<{ owner: string } | null> {
  const db = await getDb();
  const col = db.collection<CronLockDoc>("cron_locks");
  const owner = randomBytes(16).toString("hex");
  const until = new Date(now.getTime() + ttlMs);
  try {
    const doc = await col.findOneAndUpdate(
      {
        _id: job,
        $or: [{ locked_until: { $lte: now } }, { locked_until: { $exists: false } }],
      },
      { $set: { locked_until: until, owner } },
      { upsert: true, returnDocument: "after" }
    );
    if (!doc || doc.owner !== owner) return null;
    return { owner };
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    // The other worker inserted the lock doc first.
    if (code === 11000) return null;
    throw err;
  }
}

export async function releaseCronLock(job: string, owner: string, now = new Date()): Promise<void> {
  const db = await getDb();
  await db.collection<CronLockDoc>("cron_locks").updateOne(
    { _id: job, owner },
    { $set: { owner: null, locked_until: now } }
  );
}
