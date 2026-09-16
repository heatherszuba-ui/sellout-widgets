/**
 * Theme — reads mindfulwidgets-style URL params so a widget can be restyled
 * from its embed URL without touching code:
 *
 *   ?color=1e2426   card background (hex, no #)
 *   &ink=f6f0da     text colour
 *   &font=mono      mono | sans
 *   &corners=1      1 rounded, 0 square
 *   &green=…&yellow=…&red=…   status dot colours
 */
import { DEFAULT_THEME } from "./config.js";

const HEX = /^[0-9a-f]{3}([0-9a-f]{3})?$/i;

export class Theme {
  constructor(overrides = {}) {
    const t = { ...DEFAULT_THEME };
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") continue;
      if (["color", "ink", "green", "yellow", "red"].includes(k)) {
        if (HEX.test(v)) t[k] = v;
      } else if (k === "font") {
        if (v === "mono" || v === "sans") t.font = v;
      } else if (k === "corners") {
        t.corners = v === "0" || v === 0 || v === "false" ? 0 : 1;
      }
    }
    Object.assign(this, t);
  }

  static fromSearch(search) {
    const p = new URLSearchParams(search);
    return new Theme(Object.fromEntries(p.entries()));
  }

  get fontFamily() {
    return this.font === "sans"
      ? '"Inter", system-ui, -apple-system, sans-serif'
      : '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  }

  /** CSS custom properties to apply on the widget root. */
  cssVars() {
    return {
      "--bg": `#${this.color}`,
      "--ink": `#${this.ink}`,
      "--font": this.fontFamily,
      "--radius": this.corners ? "16px" : "0px",
      "--green": `#${this.green}`,
      "--yellow": `#${this.yellow}`,
      "--red": `#${this.red}`,
    };
  }
}
