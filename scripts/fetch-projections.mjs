#!/usr/bin/env node
/**
 * Reads each race's "Sell-Out Projection" database from Notion and writes
 * data/<race>.json for the widget to read.
 *
 * Runs in GitHub Actions on a schedule (see .github/workflows/refresh.yml).
 * Locally:  NOTION_TOKEN=secret_… node scripts/fetch-projections.mjs
 *
 * Output shape (one file per race):
 * {
 *   "race": "breaking3",
 *   "fetchedAt": "2026-09-16T18:00:00.000Z",
 *   "metrics": {
 *     "registered": { "metric": "Registered now", "value": 98,
 *                     "display": "98 of 300", "detail": "Day 47 of 239 …" },
 *     …one entry per Key in the database…
 *   }
 * }
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RACES } from "../src/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "data");

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN is not set.");
  process.exit(1);
}

const NOTION = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

async function queryDatabase(id) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`${NOTION}/databases/${id}/query`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) {
      throw new Error(`Notion ${res.status} for ${id}: ${await res.text()}`);
    }
    const body = await res.json();
    rows.push(...body.results);
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return rows;
}

function plain(prop) {
  if (!prop) return "";
  const parts = prop.title ?? prop.rich_text ?? [];
  return parts.map((p) => p.plain_text).join("");
}

function toMetrics(rows) {
  const metrics = {};
  for (const row of rows) {
    const p = row.properties;
    const key = plain(p.Key).trim();
    if (!key) continue;
    metrics[key] = {
      metric: plain(p.Metric),
      value: p.Value?.number ?? null,
      display: plain(p.Display),
      detail: plain(p.Detail),
    };
  }
  return metrics;
}

function unchanged(path, next) {
  try {
    const prev = JSON.parse(readFileSync(path, "utf8"));
    return JSON.stringify(prev.metrics) === JSON.stringify(next.metrics);
  } catch {
    return false;
  }
}

mkdirSync(outDir, { recursive: true });
let failures = 0;

for (const race of Object.values(RACES)) {
  const path = resolve(outDir, `${race.key}.json`);
  try {
    const rows = await queryDatabase(race.notionDatabaseId);
    const metrics = toMetrics(rows);
    if (!metrics.registered) {
      throw new Error(`no "registered" row in ${race.name} (got ${rows.length} rows)`);
    }
    const out = {
      race: race.key,
      fetchedAt: new Date().toISOString(),
      source: `notion:${race.notionDatabaseId}`,
      metrics,
    };
    if (unchanged(path, out) && process.env.FORCE !== "1") {
      console.log(`${race.key}: unchanged`);
      continue;
    }
    writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
    console.log(`${race.key}: wrote ${Object.keys(metrics).length} metrics`);
  } catch (err) {
    failures++;
    console.error(`${race.key}: ${err.message}`);
  }
}

process.exit(failures ? 1 : 0);
