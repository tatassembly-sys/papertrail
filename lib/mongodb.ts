import { MongoClient, ServerApiVersion, type MongoClientOptions } from "mongodb";
import { ensureIndexes } from "./indexes";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string | undefined {
  // Railway's MongoDB plugin commonly exposes MONGO_URL. Resolve lazily so
  // Next.js can load modules during build before runtime variables exist.
  return process.env.MONGODB_URI || process.env.MONGO_URL;
}

function getDbName(): string {
  return process.env.MONGODB_DB || "papertrail";
}

function connectClient(): Promise<MongoClient> {
  const uri = getUri();
  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI (or MONGO_URL) is not set"));
  }

  const options: MongoClientOptions = {
    // Keep request failures responsive when Atlas is unreachable. The client
    // still retries on the next request after this timeout expires.
    serverSelectionTimeoutMS: Number(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000
    ),
    // Cap idle sockets so a long-lived Railway process doesn't hold excess
    // connections against Atlas free-tier limits under low traffic.
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
  };

  // Stable API is recommended for Atlas. Railway's community Mongo plugin and
  // some older hosts may not support it — disable with MONGODB_STABLE_API=false.
  if (process.env.MONGODB_STABLE_API !== "false") {
    options.serverApi = {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    };
  }

  const client = new MongoClient(uri, options);
  return client.connect();
}

/**
 * Reuse one client/promise for the process lifetime (dev + Railway long-running
 * Node). Without this, production opened a new MongoClient on every getDb()
 * call and exhausted connection limits under load.
 */
function getClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connectClient().catch((error) => {
      // Do not permanently cache a failed handshake; a later request can retry.
      global._mongoClientPromise = undefined;
      throw error;
    });
  }
  return global._mongoClientPromise;
}

export async function getDb() {
  const client = await getClient();
  const db = client.db(getDbName());
  // Best-effort; ensureIndexes is idempotent (no-ops after first success).
  await ensureIndexes(db);
  return db;
}
