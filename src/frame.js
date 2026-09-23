/**
 * Frame colour — paints the widget page's own background so the area outside
 * the rounded card matches whatever Notion block the embed sits in.
 *
 * Why: Notion lays its page background colour over every embed frame. On a
 * plain page that is invisible; inside a coloured callout it shows as a box
 * behind the card's corners. Nothing inside the iframe can turn that off, so
 * we match the colour instead.
 *
 *   ?frame=green     Notion's green callout (dark #263d30 / light #edf3ec)
 *   ?frame=blue      Notion's blue callout  (dark #233850 / light #e5f2fc)
 *   ?frame=1e2426    any hex, used in both light and dark
 *   (omitted)        transparent — right for embeds on the plain page
 *
 * Light/dark is chosen by the viewer's system setting, which is what Notion
 * follows by default.
 */
const PRESETS = {
  green: { dark: "#263d30", light: "#edf3ec" },
  // Measured on About The Micro, 2026-09-23.
  blue: { dark: "#233850", light: "#e5f2fc" },
};

const HEX = /^[0-9a-f]{3}([0-9a-f]{3})?$/i;

export function frameColor(value, prefersLight = matchMediaLight()) {
  if (!value) return "transparent";
  const preset = PRESETS[String(value).toLowerCase()];
  if (preset) return prefersLight ? preset.light : preset.dark;
  return HEX.test(value) ? `#${value}` : "transparent";
}

export function applyFrame(search, root = document.documentElement) {
  const value = new URLSearchParams(search).get("frame");
  const paint = () => root.style.setProperty("--frame", frameColor(value));
  paint();
  if (typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", paint);
  }
}

function matchMediaLight() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: light)").matches
    : false;
}
