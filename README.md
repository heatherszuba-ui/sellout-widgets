# Sell-out widgets

Embeddable Notion widgets showing how each Micro race is tracking toward its
cap. One codebase, one widget per race, picked by URL:

```
https://<your-github-user>.github.io/sellout-widgets/?race=breaking3
https://<your-github-user>.github.io/sellout-widgets/?race=microtq
```

## What it shows

| Element | Source (Sell-Out Projection database, `Key` column) |
|---|---|
| Registered / cap / % full | `registered`, `percent` |
| Status dot | green = on pace (`projected_cap` within the window) or sold out; yellow = pace ≥ 90% of needed; red = below |
| Sell-out est. | date in `projected_cap` display, only when green |
| Pace vs last year | `pace` |
| Needed | `threshold` |
| Day N of M · Updated | `registered` detail, JSON `fetchedAt` |

Rules live in `src/config.js` (`STATUS_RULES.yellowFloor`).

## How data flows

```
RunSignup ──(runsignup-sync, daily)──▶ Notion "… — Sell-Out Projection" DBs
                                              │
                        GitHub Action, hourly (scripts/fetch-projections.mjs)
                                              ▼
                                       data/<race>.json  ──▶  index.html (widget)
```

The widget never talks to Notion and holds no secrets. The Action holds the
Notion token as a repo secret and commits the JSON.

## Files

```
index.html                  the page Notion embeds; reads ?race=
src/config.js               race registry + status rules + default theme
src/model.js                Projection class: parses metrics, decides status
src/widget.js               SellOutWidget class: fetch + render
src/theme.js                URL-param theming (?color=&ink=&font=&corners=)
src/widget.css              the look
data/<race>.json            refreshed by the Action (seeded with 2026-09-16 numbers)
scripts/fetch-projections.mjs   Notion → data/*.json
.github/workflows/refresh.yml   hourly schedule + commit
test/model.test.mjs         node --test
```

## Setup (one time)

1. Create a Notion internal integration at https://www.notion.so/my-integrations
   → New integration → name it `sellout-widgets`, workspace = The Micro,
   capabilities: **Read content** only. Copy the secret.
2. In Notion open **Breaking 3 — Sell-Out Projection**, click `…` (top right)
   → **Connections** → add `sellout-widgets`. Repeat for **micrOTQ — Sell-Out
   Projection**.
3. Create a **public** GitHub repo named `sellout-widgets` and push this folder.
4. Repo → Settings → Secrets and variables → Actions → **New repository secret**:
   name `NOTION_TOKEN`, value = the secret from step 1.
5. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save.
6. Repo → Actions → *Refresh projection data* → **Run workflow**. The first run
   replaces the seed JSON with live numbers.
7. In Notion, `/embed` → paste the widget URL (see top). Do it once per race.

## Theming

Same idea as mindfulwidgets. Any of these can be added to the embed URL:

```
?race=microtq&color=f6f6f2&ink=2d3637&font=sans&corners=1
```

`color` background, `ink` text, `font` mono|sans, `corners` 1|0, plus
`green`, `yellow`, `red` for the status dot.

## Embedding inside a coloured callout

Notion paints its page background over every embed frame, which shows as a
box behind the card's rounded corners when the embed sits in a coloured
callout. Add `&frame=green` (Notion's green callout) or `&frame=<hex>` to the
embed URL and the widget paints its own margin to match. Leave it off for
embeds on the plain page. See `src/frame.js`.

## Adding a race

Add an entry to `RACES` in `src/config.js` with the race's Notion projection
database id, share that database with the integration, push. The Action picks
it up on the next run and `?race=<key>` works.

## Greeting clock

Second widget in the same look: The Micro logo, a time-of-day greeting, and
a ticking 12-hour clock. Teammates set it up at

```
https://<your-github-user>.github.io/sellout-widgets/greeting/builder.html
```

which produces a link like `greeting/?name=Sammy&g1=…&h1=5&g2=…&h2=12…`
to paste into `/embed`. Only the name, the four greeting texts, and their
start hours are configurable; everything else is fixed in `src/greeting.css`.
Logic lives in `src/greeting.js` (`GreetingConfig`, `GreetingClock`); tests in
`test/greeting.test.mjs`.

## Local

```
npm test                       # unit tests
NOTION_TOKEN=… npm run fetch   # refresh data/ from Notion
npm run serve                  # http://localhost:8080/?race=breaking3
```

## Note on visibility

Notion embeds are plain public URLs. Anyone with the widget link can see
registration counts and pace. No names, emails, or tokens are ever in the
page or the JSON.

## Next-post countdown (`nextpost/`)

Counts down to the next slot in the posting cadence: Tue 7:00 AM, Thu 7:00 AM, Sun 8:00 AM ET (DST-safe).
Embed: `https://heatherszuba-ui.github.io/sellout-widgets/nextpost/?frame=green`
Optional `slots=tue@07:00,thu@07:00,sun@08:00` to change the cadence. Tests: `node --test test/nextpost.test.mjs`.

## Instagram follower tile (`followers/`)

Shows @handle, follower count, change over the last 7 days, and last update.
Data: `scripts/fetch-instagram.mjs` → `data/instagram.json` + `data/instagram-history.json`, run hourly by `.github/workflows/instagram.yml`.
Secrets: `IG_ACCESS_TOKEN` (required, Meta System User token), `IG_USER_ID` (optional; found automatically from the linked Facebook Page).
Embed: `https://heatherszuba-ui.github.io/sellout-widgets/followers/?frame=green`
