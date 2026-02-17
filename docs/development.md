# Development Guide

## Overview

This project is a static dashboard for Realm of the Mad God player history.

- Frontend: React + Vite + TypeScript
- Charts: uPlot
- Table: TanStack Table + TanStack Virtual
- Data artifact used by frontend: `src/data/daily.json`

## Local Setup

### Prerequisites

- Bun 1.3+
- Git
- Optional for release management: GitHub CLI (`gh`)

### Install

```bash
bun install
```

### One-time historical imports

Run these after adding/updating the source CSV exports in the repo root:

```bash
bun run migrate:realmeye
bun run migrate:realmstock
bun run migrate:launcher
bun run aggregate
```

Outputs:

- `data/realmeye-full.csv`
- `data/realmstock-full.csv`
- `data/launcher-full.csv`
- `src/data/daily.json`

## Development Commands

- Start dev server: `bun run dev`
- Build production bundle: `bun run build`
- Preview production build: `bun run preview`
- Run tests: `bun run test`
- Watch tests: `bun run test:watch`

Data pipeline commands:

- Scrape and append latest rows: `bun run scrape`
- Scrape dry run (no file writes): `bun run scrape:dry-run`
- Rebuild aggregate JSON from CSV files: `bun run aggregate`

## Data Pipeline Details

- Scraping script: `scripts/scrape.ts`
  - RealmEye source: `https://www.realmeye.com/number-of-active-players-by-rank`
  - RealmStock source: `https://realmstock.network/Public/PlayersOnline`
  - Launcher source: `https://imgur.com/ovCN2lM`
  - Appends UTC rows as `time,date,players` (RealmEye/RealmStock) and `time,date,views` (Launcher)
  - If one source fails, the others still proceed

- Aggregation script: `scripts/aggregate.ts`
  - Reads `data/realmeye-full.csv`, `data/realmstock-full.csv`, and `data/launcher-full.csv`
  - Produces a compact columnar JSON artifact in `src/data/daily.json` with key mapping:
    - `d`: dates (`YYYYMMDD`)
    - `a`: `realmeye_max`
    - `b`: `realmeye_min`
    - `c`: `realmstock_max`
    - `e`: `realmstock_min`
    - `f`: `launcher_loads`
  - Frontend code decodes this compact format into `DailyPoint[]` at runtime
  - Launcher loads are derived from day-over-day differences in cumulative daily max views and are only emitted from `2024-07-03` onward

- Migration scripts:
  - `scripts/migrate-realmeye.ts`
  - `scripts/migrate-realmstock.ts`
  - `scripts/migrate-launcher.ts`
  - Convert sheet exports to UTC release-format CSV rows

## Deployment

### GitHub Actions

Hourly CSV scrape workflow: `.github/workflows/scrape.yml`

- Schedule: `0 * * * *`
- Concurrency group: `scrape`
- High-level flow:
  1. Resolve `TARGET_TAG` as current UTC date (`YYYY-MM-DD`) and `SOURCE_TAG` as the latest dated release tag
  2. Download release CSV assets from `SOURCE_TAG`
  3. Run per-source scrape jobs (RealmEye, RealmStock, Launcher)
  4. Upload merged CSV assets to `TARGET_TAG` with `--clobber`
  5. Do not rebuild or commit `src/data/daily.json`

Daily aggregate workflow: `.github/workflows/aggregate-daily.yml`

- Schedule: `55 23 * * *`
- Concurrency group: `aggregate-daily`
- High-level flow:
  1. Resolve `SOURCE_TAG` as the latest dated release tag
  2. Download release CSV assets from `SOURCE_TAG`
  3. Rebuild `src/data/daily.json`
  4. Commit/push only when `daily.json` changes

### Cloudflare Pages

- Build command: `bun run build`
- Output directory: `dist`
- Deploy branch: `main`

Because deploy is tied to pushes, and pushes happen only when `daily.json` changes, Cloudflare redeploys only when aggregated data actually changes.

## Notes

- The app is static and reads only the committed `src/data/daily.json` at runtime.
- Fonts are currently loaded from Google Fonts via CSS import in `src/styles.css`.
