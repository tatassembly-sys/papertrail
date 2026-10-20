import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "route.ts") found.push(full.replace(/\\/g, "/"));
  }
  return found;
}

const PUBLIC_WRITES = [
  "app/api/auth/verify-email/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/auth/user-logout/route.ts",
  "app/api/newsletter/verify/route.ts",
  "app/api/newsletter/unsubscribe/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/portal/route.ts",
  "app/api/highlights/route.ts",
  "app/api/highlights/[id]/route.ts",
  "app/api/collections/route.ts",
  "app/api/collections/[id]/route.ts",
  "app/api/me/route.ts",
];

test("public writes call the shared rate limit helper", () => {
  for (const file of PUBLIC_WRITES) {
    assert.match(readFileSync(file, "utf8"), /tooManyPublicWrites/, file);
  }
});

test("route matrix names every API route file", () => {
  const matrix = readFileSync("docs/security/route-matrix.md", "utf8");
  const files = routeFiles("app/api");
  assert.ok(files.length > 30);
  for (const file of files) {
    const rel = file.slice(file.indexOf("app/api/"));
    assert.equal(matrix.includes(rel), true, rel);
  }
});
