import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("ensure-indexes refuses to connect without CONFIRM_INDEXES=yes", () => {
  const env = { ...process.env };
  delete env.CONFIRM_INDEXES;
  delete env.PAPERTRAIL_TSX;
  env.MONGODB_URI = "mongodb://127.0.0.1:1/papertrail";

  const started = Date.now();
  const result = spawnSync(process.execPath, ["scripts/ensure-indexes.mjs"], {
    encoding: "utf8",
    env,
  });
  const elapsed = Date.now() - started;

  assert.equal(result.status, 1);
  assert.match(result.stderr, /CONFIRM_INDEXES=yes/);
  assert.ok(elapsed < 2000, `refused slowly (${elapsed}ms)`);
});
