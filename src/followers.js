/**
 * Instagram follower tile. Reads data/instagram.json and
 * data/instagram-history.json (written hourly by the GitHub Action) and
 * re-reads every 15 minutes while open. Nothing is clickable.
 */
import { changeSince, formatCount, formatDelta } from "./followers-model.js";

const REFRESH_MS = 15 * 60 * 1000;

export class FollowerTile {
  constructor(root, { dataUrl = "../data/instagram.json", historyUrl = "../data/instagram-history.json" } = {}) {
    this.root = root;
    this.dataUrl = dataUrl;
    this.historyUrl = historyUrl;
    root.innerHTML = `
      <div class="fw">
        <div class="fw__label">Instagram</div>
        <div class="fw__handle"></div>
        <div class="fw__count">—</div>
        <div class="fw__foot"><span class="fw__delta"></span><span class="fw__updated"></span></div>
      </div>`;
    this.$handle = root.querySelector(".fw__handle");
    this.$count = root.querySelector(".fw__count");
    this.$delta = root.querySelector(".fw__delta");
    this.$updated = root.querySelector(".fw__updated");
  }

  async load() {
    try {
      const bust = `?t=${Math.floor(Date.now() / 60000)}`;
      const [data, history] = await Promise.all([
        fetch(this.dataUrl + bust).then((r) => (r.ok ? r.json() : null)),
        fetch(this.historyUrl + bust).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      if (!data) return this.waiting();
      this.render(data, history);
    } catch {
      this.waiting();
    }
  }

  render(data, history) {
    this.$handle.textContent = data.username ? `@${data.username}` : "";
    this.$count.textContent = formatCount(data.followers);
    const change = changeSince(history, data.followers, 7);
    this.$delta.textContent = change ? `${formatDelta(change.delta)} this week` : "";
    this.$delta.dataset.sign = change ? Math.sign(change.delta) : "";
    const d = new Date(data.fetchedAt);
    this.$updated.textContent = isNaN(d) ? "" : `Updated ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }

  waiting() {
    this.$count.textContent = "—";
    this.$handle.textContent = "";
    this.$delta.textContent = "";
    this.$updated.textContent = "Waiting for first sync";
  }

  start() {
    this.load();
    setInterval(() => this.load(), REFRESH_MS);
    return this;
  }
}
