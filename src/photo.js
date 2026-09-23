/**
 * PhotoOfTheDay — one Micro photo a day, picked from the Cloudinary folder
 * listed in data/photos.json. Same card language as the other widgets.
 *
 * URL options (all optional):
 *   frame    see src/frame.js — match the Notion callout colour
 *   label    footer text (max 24 chars, default "PHOTO OF THE DAY")
 *
 * The photo is cropped to fill whatever size the embed is, so the card never
 * changes shape day to day. Every 15 minutes it checks whether the Eastern
 * date has rolled over and swaps the photo if so.
 */
import {
  bucket,
  dateKey,
  imageUrl,
  parsePhotoData,
  pickForDate,
  shortDate,
} from "./photo-model.js";

export const MAX_LABEL = 24;
const DEFAULT_LABEL = "Photo of the day";
const CHECK_EVERY_MS = 15 * 60 * 1000;

export class PhotoOfTheDay {
  constructor(root, { dataUrl, search = "" } = {}) {
    this.root = root;
    this.dataUrl = dataUrl;
    const p = new URLSearchParams(search);
    this.label = String(p.get("label") ?? "").trim().slice(0, MAX_LABEL) || DEFAULT_LABEL;
    this.data = null;
    this.day = "";
    this.photo = null;
    this.timer = null;
    this.resizeTimer = null;
  }

  async load(day) {
    // Cache-bust once per day so a new photo list is picked up after rollover.
    const res = await fetch(`${this.dataUrl}?d=${day}`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`photos.json ${res.status}`);
    this.data = parsePhotoData(await res.json());
  }

  async refresh(now = new Date()) {
    const day = dateKey(now);
    if (day === this.day && this.photo) return;
    try {
      await this.load(day);
    } catch (err) {
      if (!this.data) return this.renderEmpty("Photos unavailable");
    }
    this.day = day;
    this.photo = pickForDate(this.data.photos, now);
    if (!this.photo) return this.renderEmpty("No photos in the folder yet");
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="pod">
        <div class="pod__frame"><img class="pod__img" alt="" /></div>
        <div class="pod__foot">
          <span class="pod__label">${escapeHtml(this.label)}</span>
          <span class="pod__date">${shortDate(this.day)}</span>
        </div>
      </div>`;
    const img = this.root.querySelector(".pod__img");
    img.alt = this.photo.alt || "The Micro photo of the day";
    img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    this.sizeImage();
  }

  /** Ask Cloudinary for exactly the box we have (rounded, times DPR). */
  sizeImage() {
    const frame = this.root.querySelector(".pod__frame");
    const img = this.root.querySelector(".pod__img");
    if (!frame || !img || !this.photo) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = frame.getBoundingClientRect();
    const w = bucket(box.width * dpr);
    // Keep the box's aspect ratio after rounding the width.
    const h = Math.round(w * (box.height / Math.max(box.width, 1)));
    const src = imageUrl(this.data.cloud, this.photo, w, h);
    if (img.getAttribute("src") !== src) img.src = src;
  }

  renderEmpty(message) {
    this.root.innerHTML = `
      <div class="pod pod--empty">
        <div class="pod__frame"><span class="pod__msg">${escapeHtml(message)}</span></div>
        <div class="pod__foot"><span class="pod__label">${escapeHtml(this.label)}</span></div>
      </div>`;
  }

  start() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), CHECK_EVERY_MS);
    // Notion embeds can be resized by dragging; re-request a matching crop.
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.sizeImage(), 250);
    });
    // A tab left open overnight: check as soon as it is looked at again.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.refresh();
    });
    return this;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
