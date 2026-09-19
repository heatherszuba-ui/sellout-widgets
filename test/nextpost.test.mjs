import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSlot, parseSlots, formatCountdown, slotLabel } from "../src/nextpost.js";

test("Saturday morning points at Sunday 8:00 AM ET (EDT)", () => {
  const n = nextSlot(new Date("2026-09-19T14:00:00Z"));
  assert.equal(n.at.toISOString(), "2026-09-20T12:00:00.000Z");
  assert.equal(slotLabel(n), "Sun 8:00 AM ET");
});

test("Tuesday after 7 AM ET moves on to Thursday", () => {
  const n = nextSlot(new Date("2026-10-13T11:00:01Z"));
  assert.equal(n.at.toISOString(), "2026-10-15T11:00:00.000Z");
});

test("Nov 1 fall-back keeps 8:00 local, which is 13:00 UTC", () => {
  const n = nextSlot(new Date("2026-10-31T20:00:00Z"));
  assert.equal(n.at.toISOString(), "2026-11-01T13:00:00.000Z");
});

test("custom slots parse and bad ones fall back", () => {
  assert.deepEqual(parseSlots("mon@09:30"), [{ day: 1, hour: 9, minute: 30 }]);
  assert.equal(parseSlots("nonsense").length, 3);
});

test("countdown formatting", () => {
  assert.deepEqual(formatCountdown(93784000), { days: 1, hms: "02:03:04" });
});
