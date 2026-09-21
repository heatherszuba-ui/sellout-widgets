import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CountdownConfig,
  countdownParts,
  headlineNumber,
  unitLabel,
  COUNTDOWN_DEFAULTS,
} from "../src/countdown.js";

test("defaults point at the next Micro race weekend", () => {
  const c = new CountdownConfig();
  assert.equal(c.date, COUNTDOWN_DEFAULTS.date);
  assert.equal(c.label, COUNTDOWN_DEFAULTS.label);
});

test("bad dates and times fall back to defaults", () => {
  const c = CountdownConfig.fromSearch("?date=2027-02-31&time=99:99");
  assert.equal(c.date, COUNTDOWN_DEFAULTS.date);
  assert.equal(c.time, "00:00");
  assert.equal(CountdownConfig.fromSearch("?date=nope").date, COUNTDOWN_DEFAULTS.date);
});

test("URL round-trip keeps date, label and sub", () => {
  const c = CountdownConfig.fromSearch("?date=2027-03-27&label=Breaking+3&sub=03.27.27");
  assert.equal(c.date, "2027-03-27");
  assert.equal(c.label, "Breaking 3");
  assert.equal(c.sub, "03.27.27");
  assert.deepEqual(CountdownConfig.fromSearch("?" + c.toSearch()), c);
});

test("labels are capped at 40 characters", () => {
  const c = CountdownConfig.fromSearch("?label=" + "x".repeat(80));
  assert.equal(c.label.length, 40);
});

test("parts split whole days from the remainder", () => {
  const target = new Date(2027, 2, 27, 0, 0, 0);
  const now = new Date(2027, 2, 24, 18, 30, 0);
  assert.deepEqual(countdownParts(target, now), {
    past: false, days: 2, hours: 5, minutes: 30,
    totalMs: target.getTime() - now.getTime(),
  });
});

test("race day and after read as go time, never negative", () => {
  const target = new Date(2027, 2, 27, 0, 0, 0);
  const parts = countdownParts(target, new Date(2027, 2, 27, 9, 0, 0));
  assert.equal(parts.past, true);
  assert.equal(parts.days, 0);
  assert.equal(headlineNumber(parts), "GO");
  assert.equal(unitLabel(parts), "it's go time");
});

test("the final day counts in hours", () => {
  const target = new Date(2027, 2, 27, 0, 0, 0);
  const parts = countdownParts(target, new Date(2027, 2, 26, 15, 0, 0));
  assert.equal(parts.days, 0);
  assert.equal(headlineNumber(parts), "9");
  assert.equal(unitLabel(parts), "hours to go");
});

test("one day is singular", () => {
  const target = new Date(2027, 2, 27, 0, 0, 0);
  const parts = countdownParts(target, new Date(2027, 2, 25, 12, 0, 0));
  assert.equal(unitLabel(parts), "day to go");
});
