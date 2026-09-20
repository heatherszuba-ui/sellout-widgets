import { test } from "node:test";
import assert from "node:assert/strict";
import { addSnapshot, changeSince, formatDelta, HISTORY_LIMIT } from "../src/followers-model.js";

test("one snapshot per day, replaced within the day", () => {
  let h = addSnapshot([], 480, new Date("2026-09-20T08:00:00Z"));
  h = addSnapshot(h, 487, new Date("2026-09-20T20:00:00Z"));
  assert.deepEqual(h, [{ date: "2026-09-20", followers: 487 }]);
  h = addSnapshot(h, 490, new Date("2026-09-21T01:00:00Z"));
  assert.equal(h.length, 2);
});

test("weekly change uses the newest snapshot at least 7 days old", () => {
  const h = [
    { date: "2026-09-10", followers: 450 },
    { date: "2026-09-13", followers: 470 },
    { date: "2026-09-18", followers: 480 },
  ];
  const c = changeSince(h, 500, 7, new Date("2026-09-20T12:00:00Z"));
  assert.deepEqual(c, { delta: 30, since: "2026-09-13" });
});

test("no weekly change until a week of history exists", () => {
  assert.equal(changeSince([{ date: "2026-09-19", followers: 480 }], 490, 7, new Date("2026-09-20T12:00:00Z")), null);
});

test("history is capped", () => {
  let h = [];
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = addSnapshot(h, i, new Date(start + i * 86400000));
  assert.equal(h.length, HISTORY_LIMIT);
});

test("delta formatting", () => {
  assert.equal(formatDelta(1200), "+1,200");
  assert.equal(formatDelta(-3), "−3");
  assert.equal(formatDelta(0), "±0");
});
