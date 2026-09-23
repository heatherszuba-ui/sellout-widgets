/**
 * Photo of the day — pure logic, no DOM. Shared by the widget and tests.
 *
 * Nothing here knows how many photos there are or what they are called.
 * The list comes from data/photos.json (written by scripts/fetch-photos.mjs
 * from whatever is in the Cloudinary folder today).
 *
 * How the daily pick works
 * ------------------------
 * Days are counted in race-HQ time (America/New_York), so everyone sees the
 * same photo and it changes at midnight Eastern.
 *
 * The list is shuffled into a "cycle" with a seeded shuffle; each day takes
 * the next photo in the cycle. That means no repeats until every photo has
 * been shown once. When the cycle ends a fresh shuffle starts, and if its
 * first photo would repeat the previous day's, the two front photos swap.
 *
 * If photos are added or removed the cycle length changes and the order
 * reshuffles. Still random, still no back-to-back repeat.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

/** YYYY-MM-DD for `now` as seen in `timeZone`. */
export function dateKey(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key. */
export function dayNumber(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** "23 SEP" style label for the footer. */
export function shortDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", {
    month: "short", timeZone: "UTC",
  });
  return `${d} ${month.toUpperCase()}`;
}

/** 32-bit FNV-1a hash of a string. Deterministic across browsers and Node. */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // murmur3 finaliser: FNV alone keeps near-identical names (…_005, …_006)
  // next to each other, which would show them on consecutive days.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The photos in cycle `cycle`, in the order they will be shown. Sorting by a
 * seeded hash of each id is a shuffle that does not depend on list order.
 */
export function cycleOrder(ids, cycle) {
  return [...ids].sort((a, b) => {
    const ha = hash(`${cycle}:${a}`);
    const hb = hash(`${cycle}:${b}`);
    return ha - hb || (a < b ? -1 : a > b ? 1 : 0);
  });
}

/**
 * Which photo to show on day `day` (from dayNumber). Returns the photo
 * object, or null for an empty list.
 */
export function pickForDay(photos, day) {
  const list = uniqueById(photos);
  const n = list.length;
  if (n === 0) return null;
  if (n === 1) return list[0];

  const ids = list.map((p) => p.id).sort();
  // Two photos: the only no-repeat schedule is to alternate.
  if (n === 2) return list.find((p) => p.id === ids[((day % 2) + 2) % 2]);

  const cycle = Math.floor(day / n);
  const pos = day - cycle * n; // always 0..n-1, also for negative days
  const order = cycleOrder(ids, cycle);

  // Avoid a back-to-back repeat across the cycle boundary.
  const prevLast = cycleOrder(ids, cycle - 1)[n - 1];
  if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]];

  const id = order[pos];
  return list.find((p) => p.id === id);
}

/** The photo for a moment in time. */
export function pickForDate(photos, now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  return pickForDay(photos, dayNumber(dateKey(now, timeZone)));
}

/**
 * Cloudinary delivery URL, cropped to fill a `width` × `height` box.
 * g_auto keeps the subject in frame; f_auto/q_auto pick the lightest format.
 */
export function imageUrl(cloud, photo, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const tx = `c_fill,g_auto,w_${w},h_${h},f_auto,q_auto`;
  const version = photo.version ? `v${photo.version}/` : "";
  const path = String(photo.id).split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/${tx}/${version}${path}`;
}

/**
 * Round a requested size up to a step so a few pixels of resize do not each
 * create a new Cloudinary derivative.
 */
export function bucket(px, step = 100) {
  return Math.max(step, Math.ceil(px / step) * step);
}

/** Validate/normalise the JSON the Action writes. */
export function parsePhotoData(json) {
  const cloud = typeof json?.cloud === "string" ? json.cloud : "";
  const photos = Array.isArray(json?.photos)
    ? json.photos.filter((p) => p && typeof p.id === "string" && p.id)
    : [];
  return { cloud, photos: uniqueById(photos), fetchedAt: json?.fetchedAt ?? null };
}

function uniqueById(photos) {
  const seen = new Set();
  const out = [];
  for (const p of photos ?? []) {
    if (!p || typeof p.id !== "string" || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
