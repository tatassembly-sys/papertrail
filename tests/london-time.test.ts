import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatLondonDateTime,
  londonParts,
  parseLondonDateTime,
  parseScheduledInstant,
} from "../lib/london-time";

const winterNow = new Date("2026-01-15T09:00:00.000Z");
const springNow = new Date("2026-03-29T00:30:00.000Z");
const summerNow = new Date("2026-07-15T00:00:00.000Z");

test("winter wall time in Europe/London is GMT", () => {
  const parsed = parseScheduledInstant("2026-01-15T09:30", winterNow);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.at.toISOString(), "2026-01-15T09:30:00.000Z");
  assert.equal(londonParts(parsed.at).hour, 9);
});

test("summer wall time in Europe/London is BST", () => {
  const parsed = parseScheduledInstant("2026-07-15T09:30", summerNow);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.at.toISOString(), "2026-07-15T08:30:00.000Z");
  assert.equal(londonParts(parsed.at).hour, 9);
  assert.equal(londonParts(parsed.at).minute, 30);
});

test("an absolute instant is not shifted a second time", () => {
  const parsed = parseScheduledInstant("2026-07-15T08:30:00.000Z", summerNow);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.at.toISOString(), "2026-07-15T08:30:00.000Z");
});

test("the March DST gap is rejected and the first valid time is kept", () => {
  const gap = parseScheduledInstant("2026-03-29T01:30", springNow);
  assert.equal(gap.ok, false);
  if (gap.ok) return;
  assert.match(gap.error, /Europe\/London/);
  const after = parseScheduledInstant("2026-03-29T02:30", springNow);
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.at.toISOString(), "2026-03-29T01:30:00.000Z");
  assert.equal(parseLondonDateTime("2026-03-29T01:00"), null);
});

test("the October overlap uses the earlier Europe/London instant", () => {
  const overlap = parseLondonDateTime("2026-10-25T01:30");
  assert.ok(overlap);
  assert.equal(overlap.toISOString(), "2026-10-25T00:30:00.000Z");
  const later = parseLondonDateTime("2026-10-25T02:30");
  assert.equal(later?.toISOString(), "2026-10-25T02:30:00.000Z");
});

test("a fixed clock rejects a London time that is not in the future", () => {
  const past = parseScheduledInstant("2026-01-15T09:00", winterNow);
  assert.equal(past.ok, false);
  const next = parseScheduledInstant("2026-01-15T09:01", winterNow);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.at.toISOString(), "2026-01-15T09:01:00.000Z");
});

test("displayed schedule time stays on the London clock", () => {
  assert.match(formatLondonDateTime("2026-07-15T08:30:00.000Z"), /09:30/);
  assert.match(formatLondonDateTime("2026-01-15T09:30:00.000Z"), /09:30/);
  assert.equal(formatLondonDateTime("not-a-date"), "");
});
