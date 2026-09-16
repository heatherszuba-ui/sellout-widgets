/**
 * SellOutWidget — renders one race's Projection into a DOM element.
 *
 *   const w = new SellOutWidget(document.getElementById("app"), {
 *     race: getRace("breaking3"),
 *     theme: Theme.fromSearch(location.search),
 *   });
 *   await w.load();
 *
 * The widget knows nothing about Notion. It fetches data/<race>.json (written
 * by the GitHub Action) and hands it to Projection. Swap `dataUrl` to point
 * at anything that serves the same JSON shape.
 */
import { Projection } from "./model.js";
import { Theme } from "./theme.js";

export class SellOutWidget {
  constructor(root, { race, theme = new Theme(), dataUrl, refreshMs } = {}) {
    if (!root) throw new Error("SellOutWidget: root element required");
    if (!race) throw new Error("SellOutWidget: race config required");
    this.root = root;
    this.race = race;
    this.theme = theme;
    this.dataUrl = dataUrl ?? `data/${race.key}.json`;
    this.refreshMs = refreshMs ?? 15 * 60 * 1000; // re-fetch while embedded
    this.projection = null;
    this._timer = null;
    this.applyTheme();
  }

  applyTheme() {
    for (const [k, v] of Object.entries(this.theme.cssVars())) {
      this.root.style.setProperty(k, v);
    }
  }

  async load() {
    try {
      const res = await fetch(`${this.dataUrl}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const raw = await res.json();
      this.projection = new Projection(raw, this.race);
      this.render();
    } catch (err) {
      this.renderError(err);
    }
    if (this.refreshMs > 0 && !this._timer) {
      this._timer = setInterval(() => this.load(), this.refreshMs);
    }
    return this.projection;
  }

  render(p = this.projection) {
    const status = p.status;
    this.root.innerHTML = `
      <div class="sw" data-status="${status}">
        <header class="sw__head">
          <div class="sw__race">${esc(this.race.displayName ?? this.race.name)}</div>
          <div class="sw__status">
            <span class="sw__dot"></span>
            <span class="sw__status-label">${esc(p.statusLabel)}</span>
          </div>
        </header>

        <div class="sw__hero">
          <div class="sw__hero-item">
            <div class="sw__big">${p.registered}</div>
            <div class="sw__hero-label">of ${p.cap} registered</div>
          </div>
          <div class="sw__hero-item">
            <div class="sw__big">${esc(p.percentDisplay)}</div>
            <div class="sw__hero-label">of field filled</div>
          </div>
        </div>

        <div class="sw__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.percent * 100)}">
          <div class="sw__bar-fill" style="width:${Math.min(100, p.percent * 100)}%"></div>
        </div>

        <div class="sw__stats">
          ${stat(`Pace vs ${esc(this.race.priorLabel)}`, p.paceDisplay)}
          ${stat("Sell-out est.", p.sellOutDisplay)}
        </div>

        <footer class="sw__foot">
          <span>${esc(p.windowDisplay)}</span>
          <span>${esc(p.updatedDisplay)}</span>
        </footer>
      </div>`;
  }

  renderError(err) {
    console.error("SellOutWidget", err);
    this.root.innerHTML = `
      <div class="sw" data-status="none">
        <header class="sw__head">
          <div class="sw__race">${esc(this.race.displayName ?? this.race.name)}</div>
        </header>
        <div class="sw__hero">
          <div class="sw__hero-item">
            <div class="sw__big sw__big--muted">—</div>
            <div class="sw__hero-label">Data unavailable</div>
          </div>
        </div>
        <footer class="sw__foot"><span>Try again in a few minutes</span></footer>
      </div>`;
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}

function stat(label, value) {
  return `
    <div class="sw__stat">
      <div class="sw__stat-value">${esc(value)}</div>
      <div class="sw__stat-label">${label}</div>
    </div>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
