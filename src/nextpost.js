/**
 * NextPost — counts down to the next slot in the posting cadence.
 *
 * The cadence is fixed in Eastern Time (the Q4 content calendar):
 *   Tue 7:00 AM · Thu 7:00 AM · Sun 8:00 AM
 * The hour stays the same local ET hour across the Nov 1 clock change.
 *
 * Optional URL params (all can be omitted):
 *   slots   comma list of day@HH:MM in ET, e.g. "tue@07:00,thu@07:00,sun@08:00"
 *   frame   see src/frame.js
 */

export const TZ = "America/New_York";
export const DEFAULT_SLOTS = Object.freeze([
  { day: 2, hour: 7, minute: 0 },
  { day: 4, hour: 7, minute: 0 },
  { day: 0, hour: 8, minute: 0 },
]);

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseSlots(value) {
  if (!value) return [...DEFAULT_SLOTS];
  const out = [];
  for (const part of String(value).split(",")) {
    const m = part.trim().toLowerCase().match(/^([a-z]{3})@(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const day = DAYS.indexOf(m[1]);
    const hour = Number(m[2]);
    const minute = Number(m[3]);
    if (day < 0 || hour > 23 || minute > 59) continue;
    out.push({ day, hour, minute });
  }
  return out.length ? out : [...DEFAULT_SLOTS];
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date, tz = TZ) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour, minute: +p.minute, second: +p.second,
    weekday: DAY_LABEL.indexOf(p.weekday),
  };
}

/** The UTC instant for a wall-clock time in a zone (DST-safe). */
export function zonedToInstant({ year, month, day, hour, minute }, tz = TZ) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = Date.UTC(year, month - 1, day, hour, minute) - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** Next slot strictly after `now`. Returns { at: Date, slot }. */
export function nextSlot(now = new Date(), slots = DEFAULT_SLOTS, tz = TZ) {
  const today = zonedParts(now, tz);
  let best = null;
  for (let add = 0; add <= 7; add++) {
    const base = new Date(Date.UTC(today.year, today.month - 1, today.day + add));
    const wd = base.getUTCDay();
    for (const s of slots) {
      if (s.day !== wd) continue;
      const at = zonedToInstant({
        year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate(),
        hour: s.hour, minute: s.minute,
      }, tz);
      if (at > now && (!best || at < best.at)) best = { at, slot: s };
    }
    if (best) break;
  }
  return best;
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return { days: d, hms };
}

export function slotLabel({ slot }) {
  const h = slot.hour % 12 || 12;
  const ap = slot.hour >= 12 ? "PM" : "AM";
  return `${DAY_LABEL[slot.day]} ${h}:${String(slot.minute).padStart(2, "0")} ${ap} ET`;
}

export class NextPost {
  constructor(root, { slots = DEFAULT_SLOTS } = {}) {
    this.root = root;
    this.slots = slots;
    this.root.innerHTML = `
      <div class="np">
        <div class="np__label">Next post</div>
        <div class="np__slot"></div>
        <div class="np__count"><span class="np__days"></span><span class="np__hms">--:--:--</span></div>
        <div class="np__local"></div>
      </div>`;
    this.$slot = root.querySelector(".np__slot");
    this.$days = root.querySelector(".np__days");
    this.$hms = root.querySelector(".np__hms");
    this.$local = root.querySelector(".np__local");
  }

  tick(now = new Date()) {
    if (!this.next || now >= this.next.at) {
      this.next = nextSlot(now, this.slots);
      this.$slot.textContent = slotLabel(this.next);
      const local = this.next.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      this.$local.textContent = `${local} your time`;
    }
    const { days, hms } = formatCountdown(this.next.at - now);
    this.$days.textContent = days ? `${days}d ` : "";
    this.$hms.textContent = hms;
  }

  start() {
    this.tick();
    setTimeout(() => { this.tick(); setInterval(() => this.tick(), 1000); }, 1000 - (Date.now() % 1000));
    return this;
  }
}
