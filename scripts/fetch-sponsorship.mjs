#!/usr/bin/env node
/**
 * Adds up money secured for the current cycle and writes
 *   data/sponsorship.json  { cycle, fetchedAt, total, parts: {...} }
 * for the sponsorship total tile (sponsorship/index.html).
 *
 * Sources (Notion database IDs):
 *   Sponsorship Lead Tracker   Signed value where Status = Signed
 *   micrOTQ Donations          Amount where Cycle = 2027
 *   Breaking 3 Donations       Amount where Cycle = 2027
 *
 * Secret: NOTION_TOKEN (same one refresh.yml uses). The integration it
 * belongs to must be connected to all three databases in Notion
 * (••• → Connections), or the query returns 404.
 *
 * Locally:  NOTION_TOKEN=secret_… node scripts/fetch-sponsorship.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSummary, CYCLE } from "../src/sponsorship-model.js";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "..", "data", "sponsorship.json");

export const SOURCES = {
  leads: "72935cd1aed7432e88d1a536b69ce3a7",
  microtq: "3dc57119b440818babc4c5fd2239b8f1",
  breaking3: "3dc57119b440813490b8ede53d1aac73",
};

const NOTION = "https://api.notion.com/v1";

async function queryDatabase(id, token, filter) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`${NOTION}/databases/${id}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor, filter }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status} for ${id}: ${await res.text()}`);
    const body = await res.json();
    rows.push(...body.results);
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("NOTION_TOKEN is not set.");
    process.exit(1);
  }
  const signed = { property: "Status", select: { equals: "Signed" } };
  const cycle = { property: "Cycle", select: { equals: CYCLE } };
  const [leads, microtq, breaking3] = await Promise.all([
    queryDatabase(SOURCES.leads, token, signed),
    queryDatabase(SOURCES.microtq, token, cycle),
    queryDatabase(SOURCES.breaking3, token, cycle),
  ]);
  const summary = buildSummary({ leads, microtq, breaking3 });

  try {
    const prev = JSON.parse(readFileSync(outFile, "utf8"));
    if (prev.total === summary.total && JSON.stringify(prev.parts) === JSON.stringify(summary.parts)
        && process.env.FORCE !== "1") {
      console.log(`Unchanged: ${summary.total}`);
      return;
    }
  } catch { /* first run */ }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(summary, null, 2) + "\n");
  console.log(`Wrote total ${summary.total} (${JSON.stringify(summary.parts)}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
