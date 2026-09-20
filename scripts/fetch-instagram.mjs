#!/usr/bin/env node
/**
 * Reads the Instagram follower count from the Meta Graph API and writes
 *   data/instagram.json          current count (what the widget shows)
 *   data/instagram-history.json  one snapshot per day (for "this week")
 *
 * Secrets (GitHub → Settings → Secrets and variables → Actions):
 *   IG_ACCESS_TOKEN  required. A System User token from Meta Business
 *                    Settings with instagram_basic + pages_show_list.
 *   IG_USER_ID       optional. If blank, the script finds the Instagram
 *                    account linked to the token's Facebook Page.
 *
 * With no token set it exits cleanly, so the workflow stays green until
 * setup is finished.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addSnapshot } from "../src/followers-model.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "data");
const GRAPH = "https://graph.facebook.com/v21.0";

const token = process.env.IG_ACCESS_TOKEN;
if (!token) {
  console.log("IG_ACCESS_TOKEN not set yet. Skipping.");
  process.exit(0);
}

async function graph(path, params = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`Graph ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function findUserId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID.trim();
  const pages = await graph("me/accounts", { fields: "name,instagram_business_account{id,username}" });
  const hit = (pages.data ?? []).find((p) => p.instagram_business_account);
  if (!hit) throw new Error("No Facebook Page with a linked Instagram professional account was found for this token.");
  console.log(`Using @${hit.instagram_business_account.username} via Page "${hit.name}".`);
  return hit.instagram_business_account.id;
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

try {
  const id = await findUserId();
  const me = await graph(id, { fields: "username,followers_count,media_count" });
  mkdirSync(outDir, { recursive: true });

  const now = new Date();
  const out = {
    username: me.username,
    followers: me.followers_count,
    posts: me.media_count,
    fetchedAt: now.toISOString(),
  };
  writeFileSync(resolve(outDir, "instagram.json"), JSON.stringify(out, null, 2) + "\n");

  const histPath = resolve(outDir, "instagram-history.json");
  const history = addSnapshot(readJson(histPath, []), me.followers_count, now);
  writeFileSync(histPath, JSON.stringify(history, null, 2) + "\n");

  console.log(`@${me.username}: ${me.followers_count} followers`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
