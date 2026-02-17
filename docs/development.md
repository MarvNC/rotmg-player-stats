# Development Guide

## Stack

- React + Vite + TypeScript
- Charts: uPlot
- Table: TanStack Table + TanStack Virtual
- Runtime artifact consumed by frontend: `src/data/daily.json`

## Setup

```bash
bun install
```

## Common Commands

- Dev: `bun run dev`
- Build: `bun run build`
- Test: `bun run test`
- Scrape (append CSV): `bun run scrape`
- Scrape dry run: `bun run scrape:dry-run`
- Aggregate JSON from CSVs: `bun run aggregate`

## Data Files

- Source/release CSVs:
  - `data/realmeye-full.csv`
  - `data/realmstock-full.csv`
  - `data/launcher-full.csv`
- Aggregated output: `src/data/daily.json`

Compact JSON mapping:

- `d`: date (`YYYYMMDD`)
- `a`: `realmeye_max`
- `c`: `realmstock_max`
- `f`: `launcher_loads`

Notes:

- `launcher_loads` is derived from cumulative launcher views using interpolation with a 48h gap guard.
- App is static and reads only committed `src/data/daily.json` at runtime.

## Workflows

- Hourly scrape: `.github/workflows/scrape.yml`
  - Schedule: `0 * * * *`
  - Downloads latest dated release CSVs, scrapes each source, uploads merged CSVs to today's tag.

- Daily aggregate: `.github/workflows/aggregate-daily.yml`
  - Schedule: `55 23 * * *`
  - Downloads latest dated release CSVs, rebuilds `src/data/daily.json`, commits only when changed.
