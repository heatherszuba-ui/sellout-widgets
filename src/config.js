/**
 * Race registry. One entry per race; the widget code is generic.
 *
 * Adding a race = adding an entry here (and its Notion database id to
 * scripts/fetch-projections.mjs via the same key). Never rename a key once
 * a widget URL is embedded in Notion — the key is the URL.
 *
 * Dates mirror src/races.ts in runsignup-sync. They are only a fallback for
 * the "Day N of M" line when the synced text cannot be parsed.
 */
export const RACES = {
  breaking3: {
    key: "breaking3",
    name: "Breaking 3",
    displayName: "BREAKING 3",
    cap: 300,
    currentLabel: "2027",
    priorLabel: "2026",
    opensOn: "2026-08-01",
    raceDay: "2027-03-27",
    notionDatabaseId: "3d957119b440819f8b86f91e37450996",
  },
  microtq: {
    key: "microtq",
    name: "micrOTQ",
    displayName: "micrOTQ",
    cap: 300,
    currentLabel: "2027",
    priorLabel: "2026",
    opensOn: "2026-08-01",
    raceDay: "2027-03-28",
    notionDatabaseId: "3d957119b44081529a8ffa6b310f6e99",
  },
};

/**
 * Status rules, agreed 2026-09-16.
 *   green  — projected to reach the cap before race day (or already full)
 *   yellow — not on pace, but current pace >= 90% of the pace needed
 *   red    — current pace below 90% of the pace needed
 */
export const STATUS_RULES = {
  yellowFloor: 0.9,
};

/** Default look: matches the mindfulwidgets countdown already on the dashboard. */
export const DEFAULT_THEME = {
  color: "1e2426", // card background
  ink: "f6f0da", // text
  font: "mono", // mono | sans
  corners: 1, // 1 = rounded, 0 = square
  green: "4ade80",
  yellow: "facc15",
  red: "f87171",
};

export function getRace(key) {
  const race = RACES[key];
  if (!race) {
    throw new Error(
      `Unknown race "${key}". Known races: ${Object.keys(RACES).join(", ")}`,
    );
  }
  return race;
}
