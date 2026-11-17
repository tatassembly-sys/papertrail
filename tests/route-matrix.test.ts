// Every app/api route file and exported method must match docs/security/route-matrix.md.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "route.ts") found.push(full.split(path.sep).join("/"));
  }
  return found.sort();
}

function exportedMethods(source: string): string[] {
  const found = new Set<string>();
  for (const method of METHODS) {
    const pattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    if (pattern.test(source)) found.add(method);
  }
  return [...found];
}

interface MatrixRow {
  file: string;
  methods: string[];
  auth: string;
  line: number;
}

function matrixRows(markdown: string): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("| `app/api/")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const file = cells[1]?.replace(/`/g, "");
    const methods = (cells[2] || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    rows.push({ file, methods, auth: cells[3] || "", line: i + 1 });
  }
  return rows;
}

function expectedGuards(auth: string, methods: string[]): RegExp[] {
  const lower = auth.toLowerCase();
  const rules: RegExp[] = [];
  if (lower.includes("cron")) rules.push(/assertCronAuthorized/);
  if (/\badmin\b/.test(lower) && !/reports admin/.test(lower)) rules.push(/requireAdmin/);
  if (lower.includes("stripe")) rules.push(/verifyStripeSignature/);
  const adminOnly = /^admin(\s|$)/.test(lower.trim());
  const writes = methods.some((method) => WRITE.has(method));
  if (writes && /public|\buser\b|token/.test(lower) && !lower.includes("stripe") && !adminOnly) {
    rules.push(/tooManyPublicWrites|hitRateLimit|isLoginRateLimited/);
  }
  return rules;
}

test("route matrix matches exported handlers and names their guards", () => {
  const markdown = readFileSync("docs/security/route-matrix.md", "utf8");
  const rows = matrixRows(markdown);
  const files = routeFiles("app/api");
  const byFile = new Map(rows.map((row) => [row.file, row]));
  console.log(`route-matrix routes=${files.length} rows=${rows.length}`);
  assert.equal(rows.length, files.length);

  for (const full of files) {
    const rel = full.slice(full.indexOf("app/api/"));
    const row = byFile.get(rel);
    assert.ok(row, `missing matrix row for ${rel}`);
    const source = readFileSync(rel, "utf8");
    const exported = exportedMethods(source);
    assert.deepEqual(exported.slice().sort(), row.methods.slice().sort(), rel);
    for (const rule of expectedGuards(row.auth, row.methods)) {
      assert.match(source, rule, `${rel} auth=${row.auth}`);
    }
  }

  for (const row of rows) {
    assert.equal(files.some((full) => full.endsWith(row.file)), true, `stale matrix row ${row.file}`);
  }
});
