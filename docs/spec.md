# ROTMG Player Tracker — Project Spec

## Overview

A static website displaying historical Realm of the Mad God activity trends over time, sourced from RealmEye, RealmStock, and launcher loads from Imgur. Data is scraped hourly via GitHub Actions, stored as CSV assets in a GitHub Release, and aggregated into a daily JSON file committed to the repo. The site is hosted on Cloudflare Pages and redeployed only when the aggregated data changes.

---

## Architecture

```
GitHub Actions (hourly cron)
│
├─ 1. Resolve latest release tag and download CSVs
├─ 2. Scrape RealmEye + RealmStock + Launcher Views, append rows to CSVs
├─ 3. Upload CSVs to today's UTC tag (YYYY-MM-DD, --clobber)
├─ 4. Re-aggregate daily.json from CSVs
└─ 5. Commit daily.json only if changed → triggers CF Pages deploy
```

```
GitHub Repo
├── .github/workflows/scrape.yml
├── scripts/
│   ├── scrape.ts          # Fetch + append to CSVs
│   └── aggregate.ts       # CSVs → daily.json
├── src/                   # React app (Vite + Bun)
│   ├── App.tsx
│   ├── components/
│   │   ├── PlayerChart.tsx # Plotly time series
│   │   ├── DataTable.tsx   # Tabular view
│   │   └── StatsCards.tsx  # Summary metrics
│   └── data/
│       └── daily.json     # Committed artifact (auto-updated)
└── public/
```

---

## Data Sources

### RealmEye — Active Player Count
- **URL:** `https://www.realmeye.com/number-of-active-players-by-rank`
- **Method:** Parse embedded JS histogram data from HTML, sum all rank buckets
- **Meaning:** Total number of accounts "active" per RealmEye's definition (cumulative/persistent metric, not live online count)

### RealmStock — Live Players Online
- **URL:** `https://realmstock.network/Public/PlayersOnline`
- **Method:** JSON API, returns a single number
- **Meaning:** Players currently connected to game servers (real-time, fluctuates throughout the day)

### Imgur — Launcher Loads Counter
- **URL:** `https://imgur.com/ovCN2lM`
- **Method:** Parse the HTML metadata text (e.g. `28,695,409 Views`) and extract cumulative view count
- **Meaning:** Cumulative launcher opens over time. Daily launcher loads are computed from day-over-day differences in cumulative daily maxima.

---

## Data Storage

### Full CSVs (GitHub Release assets)

Stored in daily releases tagged by UTC date (`YYYY-MM-DD`). Assets are overwritten during the day and a new tag is used each day.

**`realmeye-full.csv`**
```
time,date,players
08:36:15,2025-01-15,42150
20:36:11,2025-01-15,42087
```

**`realmstock-full.csv`**
```
time,date,players
08:36:15,2025-01-15,8523
09:36:15,2025-01-15,8201
```

**`launcher-full.csv`**
```
time,date,views
08:36:15,2025-01-15,28695409
09:36:15,2025-01-15,28695572
```

- No header row (keeps append trivial)
- Times in UTC
- One row per scrape

### Aggregated JSON (committed to repo)

**`src/data/daily.json`**
```json
[
  {
    "date": "2025-01-15",
    "realmeye_max": 42150,
    "realmeye_min": 42087,
    "realmstock_max": 8523,
    "realmstock_min": 7102,
    "launcher_loads": 16432
  }
]
```

- One entry per calendar day (UTC)
- `max` / `min` across all scrapes that day for RealmEye and RealmStock
- `launcher_loads` is daily loads derived from cumulative launcher views
- `null` for missing source on a given day
- This is the only file the frontend reads

### Historical Data Migration

The existing Google Sheets CSV will be cleaned and imported into `realmeye-full.csv` as a one-time migration:

- Strip metadata header rows (rows 1–4)
- Convert times from PST → UTC
- For rows during the "Realmeye bots down" period (mid-2022), use the corrected values from the Notes column where available
- Drop the `Change/24H` and `Notes` columns (change can be recomputed; notes are baked into corrected values)
- RealmStock historical data: export from the `LivePlayerCountData` sheet and clean similarly

---

## GitHub Actions Workflow

**Schedule:** Every hour at minute :36 (`36 * * * *`)

**Steps:**
1. Checkout repo
2. Setup Bun
3. Resolve source release (latest existing tag) and target release (today's UTC tag)
4. Download current CSVs from the source release via `gh release download`
5. Run `scripts/scrape.ts` — fetches all sources, appends to CSVs
6. Create today's release if missing and upload updated CSVs via `gh release upload --clobber`
7. Run `scripts/aggregate.ts` — reads CSVs, writes `src/data/daily.json`
8. If `daily.json` changed: commit and push (triggers CF Pages redeploy)
9. If unchanged (new scrape didn't beat today's max): no commit, no redeploy

**Error handling:**
- If a source is unreachable, skip it (don't append a row), continue with the other
- Log warnings but don't fail the workflow for a single source being down
- The `--clobber` upload is idempotent; safe to retry

**Concurrency:** `concurrency: { group: scrape, cancel-in-progress: false }`

**Budget:** ~720 runs/month × ~30s = ~360 min/month (well within free tier of 2,000 min)

---

## Frontend

### Stack
- **Bun** — runtime and package manager
- **Vite** — build tool
- **React** — UI
- **Plotly.js** (`react-plotly.js`) — time series charts with built-in range slider
- **Data table** — TBD (see below)
- **Deployment** — Cloudflare Pages, connected to repo, build command: `bun run build`

### Pages / Views

Single-page app with two main sections:

#### 1. Charts (default view)

**Primary chart: RealmEye Active Players Over Time**
- Plotly `scatter` trace with `mode: 'lines'`
- X axis: date, Y axis: player count
- Shaded band between daily min and max (shows intraday variance)
- Plotly range slider + range selector buttons (1M / 6M / 1Y / All)

**Secondary chart: RealmStock Live Players Over Time**
- Same treatment as above
- Displayed below the RealmEye chart, or as a toggleable overlay on the same chart

**Tertiary chart: Launcher Loads Per Day**
- Daily values from `launcher_loads`
- Displayed below the RealmStock chart and synced on X-axis range with the others

**Considerations:**
- Both charts share the same X axis range (linked zoom/pan)
- Responsive layout
- Default view: last 1 year

#### 2. Data Table

Full tabular view of daily.json. Needs to handle ~2,400+ rows efficiently.

**Library:** AG Grid Community Edition (`ag-grid-react`)
- Built-in virtual scrolling, sorting, filtering, CSV export
- ~200KB gzipped but bundled and served from CF Pages (no external fetches)
- Minimal configuration needed — well suited for "set it and forget it"

**Columns:**
- Date
- RealmEye Max
- RealmEye Min
- RealmStock Max
- RealmStock Min
- RealmEye Δ (day-over-day change, computed client-side)
- Launcher Loads
- Launcher Δ (day-over-day change, computed client-side)

**Features:**
- Sortable columns
- Date range filter (could reuse Plotly's range selection)
- CSV export button (download daily.json as CSV)

#### 3. Stats Summary

Small card row above the charts:

- **Current RealmEye count** (latest value)
- **All-time peak** (with date)
- **30-day trend** (absolute change + percentage)
- **Last updated** timestamp

### Styling

ROTMG-inspired dark theme with black and red as primary colors.

**Color palette:**
- **Background:** `#0a0a0a` (near-black)
- **Surface/cards:** `#141414` (dark gray)
- **Border/subtle:** `#2a2a2a`
- **Primary accent:** `#dc2626` (ROTMG red)
- **Primary hover:** `#ef4444` (lighter red)
- **Text primary:** `#f5f5f5`
- **Text secondary:** `#a3a3a3`
- **Positive delta:** `#22c55e` (green)
- **Negative delta:** `#dc2626` (red — matches accent, contextually clear)

**Plotly chart theming:**
- Dark paper/plot background matching site
- Red trace lines, red-tinted fill for min/max bands
- Light gray gridlines and axis text
- Range slider styled to match

**AG Grid theming:**
- Use `ag-theme-alpine-dark` as base
- Override accent colors to red
- Match background to site surface color

**Typography:**
- System font stack or a clean sans-serif (Inter, etc.)
- No pixel/retro fonts — keep it readable and modern

**General:**
- CSS Modules or Tailwind — either works, keep it consistent
- All assets bundled and served from CF Pages (no external CDN calls at runtime)
- Responsive: works on desktop and mobile, charts resize gracefully

---

## Deployment

### Cloudflare Pages
- **Build command:** `bun run build`
- **Output directory:** `dist`
- **Branch:** `main`
- **Triggers:** Push to `main` (which only happens when `daily.json` changes)

### Custom Domain (optional)
- Can be configured via CF Pages dashboard
- Free SSL included

---

## File Sizes & Performance Budget

| Asset | Estimated Size (gzipped) |
|---|---|
| `daily.json` (10 years of data) | ~50KB |
| `react` + `react-dom` | ~45KB |
| `plotly.js` (partial bundle) | ~300KB |
| `ag-grid-react` (community) | ~200KB |
| App code + CSS | ~20KB |
| **Total page weight** | **~615KB** |

Everything is bundled at build time and served from CF Pages. Zero external runtime fetches — no CDN calls, no Google Fonts, no analytics scripts. The site works fully offline after first load.

Plotly is the heaviest dependency. If this becomes a concern, uPlot (~6KB gzipped) is a drop-in-viable alternative that handles time series with range selection, but lacks Plotly's interactivity polish.
