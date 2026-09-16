// Run with:  node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Projection, STATUS } from "../src/model.js";
import { RACES } from "../src/config.js";
import { Theme } from "../src/theme.js";

const load = (key) =>
  JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url)));

test("Breaking 3 seed: on pace → green with a sell-out date", () => {
  const p = new Projection(load("breaking3"), RACES.breaking3);
  assert.equal(p.registered, 98);
  assert.equal(p.cap, 300);
  assert.equal(p.percentDisplay, "32.7%");
  assert.equal(p.pace, 1.34);
  assert.equal(p.paceNeeded, 1.2);
  assert.equal(p.status, STATUS.GREEN);
  assert.equal(p.statusLabel, "On pace");
  assert.equal(p.sellOutDate, "2026-12-12");
  assert.equal(p.sellOutDisplay, "Dec 12");
  assert.deepEqual(p.window, { day: 47, total: 239 });
});

test("micrOTQ seed: 93% of needed pace → yellow, no date", () => {
  const p = new Projection(load("microtq"), RACES.microtq);
  assert.equal(p.status, STATUS.YELLOW);
  assert.equal(p.statusLabel, "Near pace");
  assert.equal(p.sellOutDate, null);
  assert.equal(p.sellOutDisplay, "—");
  assert.ok(Math.abs(p.paceRatio - 2.72 / 2.94) < 1e-9);
});

test("red when pace is under the yellow floor", () => {
  const raw = load("microtq");
  raw.metrics.pace.value = 2.0; // 2.0 / 2.94 = 68%
  const p = new Projection(raw, RACES.microtq);
  assert.equal(p.status, STATUS.RED);
  assert.equal(p.statusLabel, "Behind");
});

test("yellow floor is configurable", () => {
  const p = new Projection(load("microtq"), RACES.microtq, { yellowFloor: 0.95 });
  assert.equal(p.status, STATUS.RED);
});

test("sold out → green 'Sold out' regardless of pace", () => {
  const raw = load("microtq");
  raw.metrics.registered.value = 300;
  raw.metrics.registered.display = "300 of 300";
  const p = new Projection(raw, RACES.microtq);
  assert.equal(p.status, STATUS.GREEN);
  assert.equal(p.statusLabel, "Sold out");
  assert.equal(p.sellOutDisplay, "Full");
});

test("projected cap past race day is NOT on pace", () => {
  const raw = load("breaking3");
  raw.metrics.projected_cap.value = 260; // window is 239 days
  raw.metrics.projected_cap.display = "Day 260 (2027-04-17)";
  const p = new Projection(raw, RACES.breaking3);
  assert.equal(p.onPace, false);
  assert.notEqual(p.status, STATUS.GREEN);
});

test("window falls back to config dates when detail text is missing", () => {
  const raw = load("breaking3");
  raw.metrics.registered.detail = "";
  raw.fetchedAt = "2026-09-16T12:00:00Z";
  const p = new Projection(raw, RACES.breaking3);
  assert.deepEqual(p.window, { day: 47, total: 239 });
});

test("sell-out date falls back to opensOn + day when display lacks a date", () => {
  const raw = load("breaking3");
  raw.metrics.projected_cap.display = "Day 134";
  const p = new Projection(raw, RACES.breaking3);
  assert.equal(p.sellOutDate, "2026-12-12");
});

test("missing metrics throws a clear error", () => {
  assert.throws(() => new Projection({}, RACES.breaking3), /missing metrics/);
});

test("theme accepts mindfulwidgets-style params and rejects junk", () => {
  const t = Theme.fromSearch("?color=f6f6f2&ink=2d3637&font=sans&corners=0&green=zzz");
  assert.equal(t.color, "f6f6f2");
  assert.equal(t.ink, "2d3637");
  assert.equal(t.font, "sans");
  assert.equal(t.corners, 0);
  assert.equal(t.green, "4ade80"); // junk ignored, default kept
  assert.equal(t.cssVars()["--radius"], "0px");
});

test("frame colour: preset follows scheme, hex is literal, junk is transparent", async () => {
  const { frameColor } = await import("../src/frame.js");
  assert.equal(frameColor("green", false), "#263d30");
  assert.equal(frameColor("green", true), "#edf3ec");
  assert.equal(frameColor("1e2426", true), "#1e2426");
  assert.equal(frameColor("zzz", false), "transparent");
  assert.equal(frameColor(null, false), "transparent");
});
