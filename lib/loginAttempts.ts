import { getDb } from "./mongodb";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

async function collection() {
  const db = await getDb();
  return db.collection<{ ip_hash: string; attempted_at: Date }>("login_attempts");
}

export async function isLoginRateLimited(ipHash: string): Promise<boolean> {
  const col = await collection();
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await col.countDocuments({ ip_hash: ipHash, attempted_at: { $gte: since } });
  return count >= MAX_ATTEMPTS;
}

export async function recordFailedLogin(ipHash: string): Promise<void> {
  const col = await collection();
  await col.insertOne({ ip_hash: ipHash, attempted_at: new Date() });
}

/** Clears this IP's failed-attempt history after a successful login. */
export async function clearLoginAttempts(ipHash: string): Promise<void> {
  const col = await collection();
  await col.deleteMany({ ip_hash: ipHash });
}
