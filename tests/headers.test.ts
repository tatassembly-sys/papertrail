import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import nextConfig from "../next.config";

test("CSP blocks eval and framing and keeps a documented inline exception", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const groups = await nextConfig.headers!();
  const global = groups.find((group) => group.source === "/:path*");
  assert.ok(global);
  const csp = global.headers.find((header) => header.key === "Content-Security-Policy")?.value || "";
  assert.equal(csp.includes("unsafe-eval"), false);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  const source = readFileSync("next.config.ts", "utf8");
  assert.match(source, /unsafe-inline/);
  assert.match(source, /inline FOUC script/);
});
