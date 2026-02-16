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
bun run aggregate
```

Outputs:

- `data/realmeye-full.csv`
- `data/realmstock-full.csv`
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
  - Appends UTC rows as `time,date,players`
  - If one source fails, the other still proceeds

- Aggregation script: `scripts/aggregate.ts`
  - Reads `data/realmeye-full.csv` and `data/realmstock-full.csv`
  - Produces day-level min/max values into `src/data/daily.json`

- Migration scripts:
  - `scripts/migrate-realmeye.ts`
  - `scripts/migrate-realmstock.ts`
  - Convert sheet exports to UTC release-format CSV rows

## Deployment

### GitHub Actions (hourly scrape)

Workflow file: `.github/workflows/scrape.yml`

- Schedule: `36 * * * *`
- Concurrency group: `scrape`
- High-level flow:
  1. Download release assets (`realmeye-full.csv`, `realmstock-full.csv`) from tag `data`
  2. Run scrape script and append latest rows
  3. Upload assets back to release with `--clobber`
  4. Rebuild `src/data/daily.json`
  5. Commit/push only when `daily.json` changes

### Cloudflare Pages

- Build command: `bun run build`
- Output directory: `dist`
- Deploy branch: `main`

Because deploy is tied to pushes, and pushes happen only when `daily.json` changes, Cloudflare redeploys only when aggregated data actually changes.

## Notes

- The app is static and reads only the committed `src/data/daily.json` at runtime.
- Fonts are currently loaded from Google Fonts via CSS import in `src/styles.css`.
