/**
 * Projection — the data model behind one race's widget.
 *
 * Input is the JSON that scripts/fetch-projections.mjs writes from the
 * "<Race> — Sell-Out Projection" Notion database. That database has one row
 * per metric, keyed by the `Key` column:
 *
 *   registered          current total            display "98 of 300"
 *   percent             fraction of cap          0.3266
 *   pace                ratio vs prior year      1.34
 *   threshold           ratio needed to fill     1.2
 *   projected_cap       day number cap is hit    134 (0 = not on pace)
 *   projected_race_day  projected final field    300
 *   prior_outcome       how last year ended      display "Sold out day 127 (…)"
 *
 * Everything the widget shows is derived here, so the renderer stays dumb
 * and the rules are unit-testable without a browser.
 */
import { STATUS_RULES } from "./config.js";

export const STATUS = Object.freeze({
  GREEN: "green",
  YELLOW: "yellow",
  RED: "red",
});

export class Projection {
  /**
   * @param {object} raw   parsed data/<race>.json
   * @param {object} race  entry from RACES
   * @param {object} [rules]  override STATUS_RULES (tests)
   */
  constructor(raw, race, rules = STATUS_RULES) {
    if (!raw || typeof raw !== "object" || !raw.metrics) {
      throw new Error("Projection: missing metrics");
    }
    this.raw = raw;
    this.race = race;
    this.rules = rules;
    this.metrics = raw.metrics;
    this.fetchedAt = raw.fetchedAt ? new Date(raw.fetchedAt) : null;
  }

  /* ---- raw metric accessors -------------------------------------- */

  metric(key) {
    return this.metrics[key] ?? { value: null, display: "", detail: "" };
  }

  get registered() {
    return num(this.metric("registered").value);
  }

  /** Cap from "98 of 300" first, config second. */
  get cap() {
    const m = /of\s+(\d+)/.exec(this.metric("registered").display ?? "");
    return m ? Number(m[1]) : this.race.cap;
  }

  get percent() {
    const v = this.metric("percent").value;
    if (v != null && Number.isFinite(v)) return v;
    return this.cap ? this.registered / this.cap : 0;
  }

  get pace() {
    return num(this.metric("pace").value);
  }

  get paceNeeded() {
    return num(this.metric("threshold").value);
  }

  get projectedCapDay() {
    return num(this.metric("projected_cap").value);
  }

  get projectedField() {
    return num(this.metric("projected_race_day").value);
  }

  get priorOutcome() {
    return this.metric("prior_outcome").display ?? "";
  }

  /* ---- derived ---------------------------------------------------- */

  get soldOut() {
    return this.cap > 0 && this.registered >= this.cap;
  }

  /** True when the sync projects the cap is reached before race day. */
  get onPace() {
    return this.projectedCapDay > 0 && this.projectedCapDay <= this.windowDays;
  }

  /** Current pace as a fraction of the pace needed (1.0 = exactly enough). */
  get paceRatio() {
    if (!this.paceNeeded) return 0;
    return this.pace / this.paceNeeded;
  }

  get status() {
    if (this.soldOut || this.onPace) return STATUS.GREEN;
    if (this.paceRatio >= this.rules.yellowFloor) return STATUS.YELLOW;
    return STATUS.RED;
  }

  get statusLabel() {
    if (this.soldOut) return "Sold out";
    switch (this.status) {
      case STATUS.GREEN:
        return "On pace";
      case STATUS.YELLOW:
        return "Near pace";
      default:
        return "Behind";
    }
  }

  /** ISO date the cap is projected to be hit, or null. */
  get sellOutDate() {
    if (!this.onPace) return null;
    const m = /\((\d{4}-\d{2}-\d{2})\)/.exec(
      this.metric("projected_cap").display ?? "",
    );
    if (m) return m[1];
    return addDays(this.race.opensOn, this.projectedCapDay - 1);
  }

  /** "Day 47 of 239" — from the synced text, else from config dates. */
  get window() {
    const m = /Day\s+(\d+)\s+of\s+(\d+)/i.exec(
      this.metric("registered").detail ?? "",
    );
    if (m) return { day: Number(m[1]), total: Number(m[2]) };
    const today = this.fetchedAt ?? new Date();
    return {
      day: daysBetween(this.race.opensOn, today) + 1,
      total: daysBetween(this.race.opensOn, this.race.raceDay) + 1,
    };
  }

  get windowDays() {
    return this.window.total;
  }

  /* ---- display strings ------------------------------------------- */

  get percentDisplay() {
    return `${Math.round(this.percent * 1000) / 10}%`;
  }

  get paceDisplay() {
    return `${round2(this.pace)}x`;
  }

  get paceNeededDisplay() {
    return `${round2(this.paceNeeded)}x`;
  }

  get sellOutDisplay() {
    if (this.soldOut) return "Full";
    const d = this.sellOutDate;
    return d ? shortDate(d) : "—";
  }

  get windowDisplay() {
    const w = this.window;
    return `Day ${w.day} of ${w.total}`;
  }

  get updatedDisplay() {
    return this.fetchedAt ? `Updated ${shortDate(this.fetchedAt)}` : "";
  }

  /** Flat snapshot — handy for tests and for anyone reading the JSON. */
  toJSON() {
    return {
      race: this.race.key,
      registered: this.registered,
      cap: this.cap,
      percent: this.percent,
      pace: this.pace,
      paceNeeded: this.paceNeeded,
      paceRatio: round2(this.paceRatio),
      status: this.status,
      statusLabel: this.statusLabel,
      sellOutDate: this.sellOutDate,
      projectedField: this.projectedField,
      window: this.window,
    };
  }
}

/* ---- helpers ------------------------------------------------------ */

function num(v) {
  return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function shortDate(input) {
  const d = typeof input === "string" ? parseISODate(input) : input;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function parseISODate(s) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(a, b) {
  const da = typeof a === "string" ? parseISODate(a) : a;
  const db = typeof b === "string" ? parseISODate(b) : b;
  return Math.floor((db - da) / 86_400_000);
}

function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
