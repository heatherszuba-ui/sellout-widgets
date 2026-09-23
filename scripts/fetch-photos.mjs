#!/usr/bin/env node
/**
 * Lists every image in the Cloudinary web-assets folder and writes
 *   data/photos.json   { cloud, folder, fetchedAt, count, photos: [...] }
 * for the photo-of-the-day widget (photo/index.html).
 *
 * Nothing about the photos is hard-coded: add or remove images in the folder
 * and the next run picks that up.
 *
 * Secret (GitHub → Settings → Secrets and variables → Actions):
 *   CLOUDINARY_URL   cloudinary://<api_key>:<api_secret>@<cloud_name>
 *                    (copy it from Cloudinary → Settings → API Keys →
 *                    "API environment variable")
 *
 * Optional:
 *   PHOTO_FOLDER     defaults to brands/themicro/photos/web-assets
 *
 * With no secret set it exits cleanly, so the workflow stays green until
 * setup is finished.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "..", "data", "photos.json");
const FOLDER = (process.env.PHOTO_FOLDER || "brands/themicro/photos/web-assets").replace(/^\/+|\/+$/g, "");

export function parseCloudinaryUrl(value) {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(String(value ?? "").trim());
  if (!m) return null;
  return { key: m[1], secret: m[2], cloud: m[3] };
}

/** Search API resource → the small record the widget needs. */
export function toPhoto(r) {
  const ctx = r.context?.custom ?? r.context ?? {};
  return {
    id: r.public_id,
    version: r.version ?? null,
    width: r.width ?? null,
    height: r.height ?? null,
    alt: ctx.alt || ctx.caption || "",
  };
}

async function searchAll({ key, secret, cloud }) {
  const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
  const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/search`;
  // Works for both folder modes: asset_folder (dynamic) and folder (fixed).
  const expression =
    `resource_type:image AND (asset_folder="${FOLDER}" OR folder="${FOLDER}")`;
  const out = [];
  let cursor;
  do {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        expression,
        max_results: 500,
        with_field: ["context"],
        sort_by: [{ public_id: "asc" }],
        ...(cursor ? { next_cursor: cursor } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
    out.push(...(body.resources ?? []));
    cursor = body.next_cursor;
  } while (cursor);
  return out;
}

async function main() {
  const creds = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  if (!creds) {
    console.log("CLOUDINARY_URL not set yet. Skipping.");
    return;
  }
  const resources = await searchAll(creds);
  const photos = resources
    .filter((r) => r.status === undefined || r.status === "active")
    .map(toPhoto)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({
    cloud: creds.cloud,
    folder: FOLDER,
    fetchedAt: new Date().toISOString(),
    count: photos.length,
    photos,
  }, null, 2) + "\n");
  console.log(`Wrote ${photos.length} photos from ${FOLDER}.`);
}

// Only run when executed directly (tests import the helpers).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
