/**
 * GreetingClock — a live ticking clock with a time-of-day greeting.
 *
 * What a teammate can change (all via the embed URL, built by
 * greeting/builder.html):
 *   name      first name shown after the greeting (blank = no name)
 *   g1..g4    the four greeting texts (max 24 chars)
 *   h1..h4    the hour (0–23) each greeting starts
 *
 * Everything else is fixed: 12-hour time, ticking seconds, dark card,
 * mono type, The Micro logo. There are no other parameters.
 */

export const GREETING_DEFAULTS = Object.freeze({
  name: "",
  slots: [
    { text: "Good morning", hour: 5 },
    { text: "Good afternoon", hour: 12 },
    { text: "Good evening", hour: 17 },
    { text: "Good night", hour: 21 },
  ],
});

export const MAX_GREETING_LENGTH = 24;
export const MAX_NAME_LENGTH = 20;

/** Parsed, validated settings. Bad or missing values fall back to defaults. */
export class GreetingConfig {
  constructor({ name = "", slots = [] } = {}) {
    this.name = clampText(name, MAX_NAME_LENGTH);
    this.slots = GREETING_DEFAULTS.slots.map((d, i) => {
      const s = slots[i] ?? {};
      const text = clampText(s.text ?? "", MAX_GREETING_LENGTH) || d.text;
      const raw = String(s.hour ?? "").trim();
      const n = Number(raw);
      const hour =
        raw !== "" && Number.isInteger(n) && n >= 0 && n <= 23 ? n : d.hour;
      return { text, hour };
    });
  }

  static fromSearch(search) {
    const p = new URLSearchParams(search);
    return new GreetingConfig({
      name: p.get("name") ?? "",
      slots: [1, 2, 3, 4].map((i) => ({
        text: p.get(`g${i}`) ?? "",
        hour: p.get(`h${i}`) ?? "",
      })),
    });
  }

  toSearch() {
    const p = new URLSearchParams();
    if (this.name) p.set("name", this.name);
    this.slots.forEach((s, i) => {
      p.set(`g${i + 1}`, s.text);
      p.set(`h${i + 1}`, String(s.hour));
    });
    return p.toString();
  }

  /**
   * The greeting active at a given hour: the slot with the latest start
   * hour that is <= now. Before the earliest slot, wrap to the latest one
   * (so 2am shows the "night" greeting, not the "morning" one).
   */
  greetingFor(hour) {
    const sorted = [...this.slots].sort((a, b) => a.hour - b.hour);
    let active = sorted[sorted.length - 1];
    for (const s of sorted) {
      if (s.hour <= hour) active = s;
    }
    return active.text;
  }

  greetingLine(hour) {
    const g = this.greetingFor(hour);
    return this.name ? `${g}, ${this.name}` : g;
  }
}

/** Formats a Date as 12-hour parts: { time: "9:41:07", period: "PM" }. */
export function formatTime(date) {
  let h = date.getHours();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return { time: `${h}:${mm}:${ss}`, period };
}

export class GreetingClock {
  constructor(root, { config = new GreetingConfig(), logoSrc } = {}) {
    if (!root) throw new Error("GreetingClock: root element required");
    this.root = root;
    this.config = config;
    this.logoSrc = logoSrc ?? "../assets/the-micro-logo-horizontal-gold.png";
    this._timer = null;
    this.renderShell();
  }

  renderShell() {
    this.root.innerHTML = `
      <div class="gc">
        <header class="gc__head">
          <img class="gc__logo" src="${this.logoSrc}" alt="The Micro" />
        </header>
        <div class="gc__greeting"></div>
        <div class="gc__time">
          <span class="gc__digits">--:--:--</span>
          <span class="gc__period"></span>
        </div>
      </div>`;
    this.$greeting = this.root.querySelector(".gc__greeting");
    this.$digits = this.root.querySelector(".gc__digits");
    this.$period = this.root.querySelector(".gc__period");
  }

  tick(now = new Date()) {
    const { time, period } = formatTime(now);
    this.$digits.textContent = time;
    this.$period.textContent = period;
    const line = this.config.greetingLine(now.getHours());
    if (this.$greeting.textContent !== line) this.$greeting.textContent = line;
  }

  start() {
    this.tick();
    // Align the interval to the next whole second so the tick is crisp.
    const delay = 1000 - (Date.now() % 1000);
    setTimeout(() => {
      this.tick();
      this._timer = setInterval(() => this.tick(), 1000);
    }, delay);
    return this;
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}

function clampText(s, max) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
