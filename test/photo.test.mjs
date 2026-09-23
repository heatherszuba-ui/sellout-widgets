import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey, dayNumber, shortDate, pickForDay, pickForDate, imageUrl, bucket, parsePhotoData,
} from "../src/photo-model.js";
import { parseCloudinaryUrl, toPhoto, hasPlaceholder } from "../scripts/fetch-photos.mjs";

const make = (n, prefix = "p") =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${String(i).padStart(3, "0")}` }));

test("day rolls over at midnight Eastern, not UTC or Phoenix", () => {
  // 03:59 UTC on 24 Sep = 23:59 EDT on 23 Sep.
  assert.equal(dateKey(new Date("2026-09-24T03:59:00Z")), "2026-09-23");
  assert.equal(dateKey(new Date("2026-09-24T04:00:00Z")), "2026-09-24");
  // Winter (EST, UTC-5).
  assert.equal(dateKey(new Date("2027-01-10T04:59:00Z")), "2027-01-09");
  assert.equal(dateKey(new Date("2027-01-10T05:00:00Z")), "2027-01-10");
});

test("footer date reads like 23 SEP", () => {
  assert.equal(shortDate("2026-09-23"), "23 SEP");
  assert.equal(shortDate("2027-03-01"), "1 MAR");
});

test("same day gives the same photo; works for any list size", () => {
  for (const n of [1, 2, 3, 7, 42, 43, 500]) {
    const photos = make(n);
    const d = dayNumber("2026-09-23");
    assert.equal(pickForDay(photos, d), pickForDay(photos, d));
    assert.ok(photos.includes(pickForDay(photos, d)));
  }
});

test("empty list gives null instead of throwing", () => {
  assert.equal(pickForDay([], 100), null);
  assert.equal(pickForDate([], new Date()), null);
});

test("every photo is shown once before any repeats", () => {
  const photos = make(42);
  const start = 42 * 500; // start of a cycle
  const seen = new Set();
  for (let d = start; d < start + 42; d++) seen.add(pickForDay(photos, d).id);
  assert.equal(seen.size, 42);
});

test("never the same photo two days running, across many cycles and sizes", () => {
  for (const n of [2, 3, 5, 41, 42, 43]) {
    const photos = make(n);
    let prev = null;
    for (let d = 20000; d < 20000 + n * 60; d++) {
      const id = pickForDay(photos, d).id;
      assert.notEqual(id, prev, `n=${n} day=${d}`);
      prev = id;
    }
  }
});

test("pick does not depend on the order the list arrives in", () => {
  const photos = make(30);
  const reversed = [...photos].reverse();
  for (let d = 20500; d < 20530; d++) {
    assert.equal(pickForDay(photos, d).id, pickForDay(reversed, d).id);
  }
});

test("names and naming conventions do not matter", () => {
  const photos = [
    { id: "a/b/IMG 0001.jpg" }, { id: "finish-line" }, { id: "Ω" }, { id: "x_credit_Someone" },
  ];
  const ids = new Set();
  for (let d = 0; d < 4; d++) ids.add(pickForDay(photos, 20000 * 4 + d).id);
  assert.equal(ids.size, 4);
});

test("duplicate ids in the data are ignored", () => {
  const photos = [{ id: "a" }, { id: "a" }, { id: "b" }];
  assert.deepEqual(parsePhotoData({ cloud: "c", photos }).photos.map((p) => p.id), ["a", "b"]);
});

test("bad JSON shapes degrade to an empty list", () => {
  assert.deepEqual(parsePhotoData(null).photos, []);
  assert.deepEqual(parsePhotoData({ photos: "nope" }).photos, []);
  assert.deepEqual(parsePhotoData({ photos: [{}, { id: 5 }, { id: "ok" }] }).photos, [{ id: "ok" }]);
});

test("image URL crops to the box and encodes odd characters", () => {
  const url = imageUrl("demo", { id: "folder/My Photo #1", version: 123 }, 300.4, 400.6);
  assert.equal(
    url,
    "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_300,h_401,f_auto,q_auto/v123/folder/My%20Photo%20%231",
  );
  assert.ok(!imageUrl("demo", { id: "x" }, 10, 10).includes("/v"));
});

test("sizes round up to 100px steps", () => {
  assert.equal(bucket(1), 100);
  assert.equal(bucket(301), 400);
  assert.equal(bucket(600), 600);
});

test("CLOUDINARY_URL parsing", () => {
  assert.deepEqual(parseCloudinaryUrl("cloudinary://123:abc-DEF@dfaiiaxym"), {
    key: "123", secret: "abc-DEF", cloud: "dfaiiaxym",
  });
  assert.equal(parseCloudinaryUrl(""), null);
  assert.equal(parseCloudinaryUrl("https://nope"), null);
});

test("search results map to the widget's record", () => {
  assert.deepEqual(
    toPhoto({ public_id: "f/x", version: 9, width: 10, height: 20, context: { custom: { alt: "Finish" } } }),
    { id: "f/x", version: 9, width: 10, height: 20, alt: "Finish" },
  );
  assert.equal(toPhoto({ public_id: "f/y" }).alt, "");
});

test("frame presets include Notion's blue callout", async () => {
  const { frameColor } = await import("../src/frame.js");
  assert.equal(frameColor("blue", false), "#233850");
  assert.equal(frameColor("blue", true), "#e5f2fc");
  assert.equal(frameColor("green", false), "#263d30");
});

test("CLOUDINARY_URL pasted with its prefix or placeholders", () => {
  const c = parseCloudinaryUrl("CLOUDINARY_URL=cloudinary://123:abc@dfaiiaxym");
  assert.deepEqual(c, { key: "123", secret: "abc", cloud: "dfaiiaxym" });
  assert.equal(hasPlaceholder(c), false);
  assert.equal(hasPlaceholder(parseCloudinaryUrl("cloudinary://<your_api_key>:<your_api_secret>@dfaiiaxym")), true);
});
