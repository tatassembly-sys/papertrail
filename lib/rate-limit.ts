import { getDb } from "./mongodb";

type RateDoc = {
  bucket: string;
  key: string;
  window: number;
  count: number;
  at: Date;
};

/**
 * Atomic IP-based rate limiting stored in MongoDB.
 * One document per bucket+key+window; $inc avoids check-then-insert races.
 * Keys should already be hashed (see hashIp).
 */
export async function hitRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const safeKey = key || "unknown";
  const safeWindow = windowMs > 0 ? windowMs : 60_000;
  const windowId = Math.floor(Date.now() / safeWindow);
  const col = await collection();

  try {
    const result = await col.findOneAndUpdate(
      { bucket, key: safeKey, window: windowId },
      {
        $inc: { count: 1 },
        $setOnInsert: { bucket, key: safeKey, window: windowId, at: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );
    const count = result?.count ?? 1;
    return count > max;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    if (code !== 11000) throw err;
    const retry = await col.findOneAndUpdate(
      { bucket, key: safeKey, window: windowId },
      { $inc: { count: 1 } },
      { returnDocument: "after" }
    );
    return (retry?.count ?? max + 1) > max;
  }
}

/** Undo a reservation after a failed downstream call (e.g. LLM 502). */
export async function undoRateLimit(
  bucket: string,
  key: string,
  windowMs: number
): Promise<void> {
  const safeKey = key || "unknown";
  const safeWindow = windowMs > 0 ? windowMs : 60_000;
  const windowId = Math.floor(Date.now() / safeWindow);
  const col = await collection();
  await col.updateOne(
    { bucket, key: safeKey, window: windowId, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}

export async function getRateCount(
  bucket: string,
  key: string,
  windowMs: number
): Promise<number> {
  const safeKey = key || "unknown";
  const safeWindow = windowMs > 0 ? windowMs : 60_000;
  const windowId = Math.floor(Date.now() / safeWindow);
  const col = await collection();
  const doc = await col.findOne({ bucket, key: safeKey, window: windowId });
  return doc?.count ?? 0;
}

async function collection() {
  const db = await getDb();
  return db.collection<RateDoc>("rate_limits");
}
