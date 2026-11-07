/**
 * Sponsorship total tile. Reads data/sponsorship.json (written by
 * scripts/fetch-sponsorship.mjs) and re-reads every 15 minutes while open.
 * Nothing is clickable.
 *
 * URL options (all optional):
 *   frame    see src/frame.js — match the Notion callout colour
 *   label    top label (max 28 chars, default "Secured · <cycle>")
 */
import { formatMoney } from "./sponsorship-model.js";

const REFRESH_MS = 15 * 60 * 1000;
const MAX_LABEL = 28;

export class SponsorshipTile {
  constructor(root, { dataUrl = "../data/sponsorship.json", search = "" } = {}) {
    this.root = root;
    this.dataUrl = dataUrl;
    this.label = String(new URLSearchParams(search).get("label") ?? "").trim().slice(0, MAX_LABEL);
    root.innerHTML = `
      <div class="sp">
        <div class="sp__label"></div>
        <div class="sp__total">—</div>
        <div class="sp__parts"></div>
        <div class="sp__updated"></div>
      </div>`;
    this.$label = root.querySelector(".sp__label");
    this.$total = root.querySelector(".sp__total");
    this.$parts = root.querySelector(".sp__parts");
    this.$updated = root.querySelector(".sp__updated");
    this.$label.textContent = this.label || "Secured";
  }

  async load() {
    try {
      const res = await fetch(`${this.dataUrl}?t=${Math.floor(Date.now() / 60000)}`);
      if (!res.ok) return this.waiting();
      this.render(await res.json());
    } catch {
      this.waiting();
    }
  }

  render(data) {
    if (!this.label) this.$label.textContent = `Secured · ${data.cycle ?? ""}`.trim();
    this.$total.textContent = formatMoney(data.total);
    const p = data.parts ?? {};
    const donations = (p.microtqDonations ?? 0) + (p.breaking3Donations ?? 0);
    this.$parts.innerHTML = `
      <span>Sponsors <b>${formatMoney(p.sponsors ?? 0)}</b></span>
      <span>Donations <b>${formatMoney(donations)}</b></span>`;
    const d = new Date(data.fetchedAt);
    this.$updated.textContent = isNaN(d) ? "" : `Updated ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }

  waiting() {
    this.$total.textContent = "—";
    this.$parts.textContent = "";
    this.$updated.textContent = "Waiting for first sync";
  }

  start() {
    this.load();
    setInterval(() => this.load(), REFRESH_MS);
    return this;
  }
}
