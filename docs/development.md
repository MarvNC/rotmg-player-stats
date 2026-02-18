# Development Guide

## Stack

- React + Vite + TypeScript
- Charts: uPlot
- Table: TanStack Table + TanStack Virtual
- Runtime artifact consumed by frontend: `https://raw.githubusercontent.com/MarvNC/rotmg-player-stats/data/daily.json`

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
- Aggregated output (generated in CI): `src/data/daily.json`
- Published runtime snapshot: `daily.json` on `data` branch

Compact JSON mapping:

- `u`: aggregate update timestamp (ISO 8601 UTC)
- `d`: date (`YYYYMMDD`)
- `a`: `realmeye_max`
- `c`: `realmstock_max`
- `f`: `launcher_loads`

Notes:

- `launcher_loads` is derived from cumulative launcher views using interpolation with a 48h gap guard.
- App fetches runtime data from `raw.githubusercontent.com` (the `data` branch snapshot).

## Workflows

- Hourly scrape: `.github/workflows/scrape.yml`
  - Schedule: `0 * * * *`
  - Downloads latest dated release CSVs, scrapes each source, uploads merged CSVs to today's tag.
  - Rebuilds `src/data/daily.json` and force-pushes `daily.json` to the `data` branch.
