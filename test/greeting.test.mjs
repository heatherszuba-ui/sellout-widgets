import { test } from "node:test";
import assert from "node:assert/strict";
import { GreetingConfig, formatTime } from "../src/greeting.js";

test("defaults pick the right greeting across the day", () => {
  const c = new GreetingConfig();
  assert.equal(c.greetingFor(5), "Good morning");
  assert.equal(c.greetingFor(11), "Good morning");
  assert.equal(c.greetingFor(12), "Good afternoon");
  assert.equal(c.greetingFor(17), "Good evening");
  assert.equal(c.greetingFor(21), "Good night");
  assert.equal(c.greetingFor(23), "Good night");
  assert.equal(c.greetingFor(2), "Good night", "before the first slot wraps to the last");
});

test("URL round-trip keeps name, texts and hours", () => {
  const c = GreetingConfig.fromSearch("?name=Heather&g1=slam+some+coffee&h1=6&g2=get+productive&h2=10&g3=windin%27+it+down&h3=16&g4=go+to+sleep+now&h4=22");
  assert.equal(c.name, "Heather");
  assert.equal(c.slots[0].text, "slam some coffee");
  assert.equal(c.slots[2].text, "windin' it down");
  assert.deepEqual(c.slots.map((s) => s.hour), [6, 10, 16, 22]);
  const again = GreetingConfig.fromSearch("?" + c.toSearch());
  assert.deepEqual(again.slots, c.slots);
  assert.equal(again.name, "Heather");
});

test("greeting line adds the name only when set", () => {
  assert.equal(new GreetingConfig({ name: "Sammy" }).greetingLine(9), "Good morning, Sammy");
  assert.equal(new GreetingConfig().greetingLine(9), "Good morning");
});

test("bad input falls back to defaults and lengths are capped", () => {
  const c = GreetingConfig.fromSearch("?g1=" + "x".repeat(60) + "&h1=99&h2=-1&h3=abc");
  assert.equal(c.slots[0].text.length, 24);
  assert.deepEqual(c.slots.map((s) => s.hour), [5, 12, 17, 21]);
  assert.equal(c.slots[1].text, "Good afternoon");
});

test("unsorted hours still resolve correctly", () => {
  const c = new GreetingConfig({ slots: [
    { text: "late", hour: 22 }, { text: "early", hour: 4 },
    { text: "mid", hour: 13 }, { text: "eve", hour: 18 },
  ] });
  assert.equal(c.greetingFor(1), "late");
  assert.equal(c.greetingFor(4), "early");
  assert.equal(c.greetingFor(15), "mid");
});

test("12-hour time formatting", () => {
  assert.deepEqual(formatTime(new Date(2026, 8, 16, 0, 5, 9)), { time: "12:05:09", period: "AM" });
  assert.deepEqual(formatTime(new Date(2026, 8, 16, 12, 0, 0)), { time: "12:00:00", period: "PM" });
  assert.deepEqual(formatTime(new Date(2026, 8, 16, 21, 41, 7)), { time: "9:41:07", period: "PM" });
});
