import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILD_PHASE, loadForIsr } from "../lib/isr-fallback";

const down = () => Promise.reject(new Error("db down"));

function spy() {
  const calls: string[] = [];
  return {
    calls,
    optOutOfPrerender: async () => {
      calls.push("opt-out");
    },
  };
}

test("ISR loads return data and never opt out when the load works", async () => {
  const s = spy();
  assert.deepEqual(await loadForIsr(async () => [1, 2], { phase: undefined, ...s }), [1, 2]);
  assert.deepEqual(await loadForIsr(async () => [3], { phase: BUILD_PHASE, ...s }), [3]);
  assert.deepEqual(s.calls, []);
});

test("a failed load during next build opts the route out of prerendering", async () => {
  const s = spy();
  // In a real build, connection() throws Next's own bail-out error here.
  await assert.rejects(() => loadForIsr(down, { phase: BUILD_PHASE, ...s }), /db down/);
  assert.deepEqual(s.calls, ["opt-out"]);
});

test("a failed load at runtime throws so the last good ISR page is kept", async () => {
  const s = spy();
  await assert.rejects(() => loadForIsr(down, { phase: undefined, ...s }), /db down/);
  await assert.rejects(() => loadForIsr(down, { phase: "phase-production-server", ...s }), /db down/);
  assert.deepEqual(s.calls, []);
});

test("ISR index pages never cache an empty fallback for a failed load", () => {
  for (const f of ["app/authors/page.tsx", "app/topics/page.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /export const revalidate = \d+/, f);
    assert.match(src, /loadForIsr\(/, f);
    assert.doesNotMatch(src, /\.catch\(\(\) => \[\]\)/, f);
  }
});
