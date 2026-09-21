/**
 * RaceCountdown — days remaining until a race, in the same card language as
 * the sell-out and greeting widgets.
 *
 * Everything is set from the embed URL:
 *   date     the race date, YYYY-MM-DD (required; invalid falls back to the
 *            next Micro race weekend)
 *   time     optional local start time, HH:MM (default 00:00)
 *   label    what we are counting down to (max 40 chars)
 *   sub      optional second line, e.g. the race weekend span (max 40 chars)
 *   frame    see src/frame.js — match the Notion callout colour
 *
 * The countdown is computed against the VIEWER's clock, which is what people
 * expect from a "days to go" number. Once the date passes it shows a race-day
 * state rather than counting negative.
 */

export const COUNTDOWN_DEFAULTS = Object.freeze({
  date: "2027-03-27",
  time: "00:00",
  label: "Breaking 3 + micrOTQ",
  sub: "03.27.27 – 03.28.27",
});

export const MAX_LABEL_LENGTH = 40;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export class CountdownConfig {
  constructor({ date = "", time = "", label = "", sub = "" } = {}) {
    this.date = DATE_RE.test(String(date).trim()) && isRealDate(String(date).trim())
      ? String(date).trim()
      : COUNTDOWN_DEFAULTS.date;
    this.time = TIME_RE.test(String(time).trim())
      ? String(time).trim()
      : COUNTDOWN_DEFAULTS.time;
    this.label = clampText(label, MAX_LABEL_LENGTH) || COUNTDOWN_DEFAULTS.label;
    this.sub = clampText(sub, MAX_LABEL_LENGTH);
  }

  static fromSearch(search) {
    const p = new URLSearchParams(search);
    return new CountdownConfig({
      date: p.get("date") ?? "",
      time: p.get("time") ?? "",
      label: p.get("label") ?? "",
      sub: p.get("sub") ?? "",
    });
  }

  toSearch() {
    const p = new URLSearchParams();
    p.set("date", this.date);
    if (this.time !== COUNTDOWN_DEFAULTS.time) p.set("time", this.time);
    p.set("label", this.label);
    if (this.sub) p.set("sub", this.sub);
    return p.toString();
  }

  /** Local Date for the moment we are counting down to. */
  target() {
    const [y, m, d] = this.date.split("-").map(Number);
    const [hh, mm] = this.time.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
}

/**
 * Remaining time, split for display. `days` counts whole days; `hours` and
 * `minutes` are the remainder within the final day.
 */
export function countdownParts(target, now = new Date()) {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { past: true, days: 0, hours: 0, minutes: 0, totalMs: ms };
  const minutes = Math.floor(ms / 60000);
  return {
    past: false,
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    totalMs: ms,
  };
}

/** The word under the big number, pluralised. */
export function unitLabel(parts) {
  if (parts.past) return "it's go time";
  if (parts.days === 0) return "hours to go";
  return parts.days === 1 ? "day to go" : "days to go";
}

/** The big number itself — days, or hours on the final day. */
export function headlineNumber(parts) {
  if (parts.past) return "GO";
  return String(parts.days === 0 ? parts.hours : parts.days);
}

export class RaceCountdown {
  constructor(root, { config = new CountdownConfig(), logoSrc = "" } = {}) {
    this.root = root;
    this.config = config;
    this.logoSrc = logoSrc;
    this.timer = null;
  }

  render(now = new Date()) {
    const parts = countdownParts(this.config.target(), now);
    const detail = parts.past
      ? ""
      : `${parts.hours}h ${String(parts.minutes).padStart(2, "0")}m`;
    this.root.innerHTML = `
      <div class="rc">
        <div class="rc__head">
          ${this.logoSrc ? `<img class="rc__logo" src="${this.logoSrc}" alt="The Micro" />` : ""}
        </div>
        <div class="rc__body">
          <div class="rc__digits">${headlineNumber(parts)}</div>
          <div class="rc__unit">${unitLabel(parts)}</div>
        </div>
        <div class="rc__foot">
          <div class="rc__label">${escapeHtml(this.config.label)}</div>
          ${this.config.sub ? `<div class="rc__sub">${escapeHtml(this.config.sub)}</div>` : ""}
          ${detail ? `<div class="rc__detail">+ ${detail}</div>` : ""}
        </div>
      </div>`;
  }

  start() {
    this.render();
    // A minute is plenty — nothing on screen changes faster than that.
    this.timer = setInterval(() => this.render(), 60000);
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function clampText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function isRealDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
