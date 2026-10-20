/**
 * Apply the indexes in lib/indexes.ts. Idempotent.
 * Refuses to connect unless CONFIRM_INDEXES=yes.
 *
 *   CONFIRM_INDEXES=yes node scripts/ensure-indexes.mjs
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_INDEXES !== "yes") {
  console.error("Refusing to create indexes. Set CONFIRM_INDEXES=yes.");
  process.exit(1);
}

if (process.env.PAPERTRAIL_TSX !== "1") {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(import.meta.url)],
    {
      stdio: "inherit",
      env: { ...process.env, PAPERTRAIL_TSX: "1" },
    }
  );
  process.exit(result.status ?? 1);
}

const { getDb } = await import("../lib/mongodb.ts");

function safeMessage(error) {
  const text = error instanceof Error ? error.message : "Index bootstrap failed.";
  if (/mongodb(\+srv)?:\/\//i.test(text)) return "Index bootstrap failed.";
  return text;
}

try {
  const db = await getDb();
  const names = (await db.collection("articles").indexes()).map((index) => index.name);
  if (!names.includes("articles_slug_unique") || !names.includes("articles_text_search_v2")) {
    console.error("Index bootstrap finished without the article indexes.");
    process.exit(1);
  }
  console.log(`Indexes ensured on ${db.databaseName}.`);
  process.exit(0);
} catch (error) {
  console.error(safeMessage(error));
  process.exit(1);
}
