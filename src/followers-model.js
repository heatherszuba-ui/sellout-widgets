/**
 * Pure helpers for the Instagram follower widget and its fetch script.
 * No DOM, no network — tested in test/followers.test.mjs.
 */

export const HISTORY_LIMIT = 400;

/** Adds or replaces today's snapshot (one per UTC day), newest last. */
export function addSnapshot(history, followers, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const kept = (Array.isArray(history) ? history : []).filter((h) => h && h.date !== date);
  kept.push({ date, followers });
  kept.sort((a, b) => a.date.localeCompare(b.date));
  return kept.slice(-HISTORY_LIMIT);
}

/**
 * Change against the most recent snapshot at least `days` old.
 * Returns null until there is one.
 */
export function changeSince(history, current, days = 7, now = new Date()) {
  if (!Array.isArray(history) || typeof current !== "number") return null;
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const older = history.filter((h) => h.date <= cutoff && typeof h.followers === "number");
  if (!older.length) return null;
  const base = older[older.length - 1];
  return { delta: current - base.followers, since: base.date };
}

export function formatCount(n) {
  return typeof n === "number" ? n.toLocaleString("en-US") : "—";
}

export function formatDelta(delta) {
  if (delta > 0) return `+${formatCount(delta)}`;
  if (delta < 0) return `−${formatCount(Math.abs(delta))}`;
  return "±0";
}
