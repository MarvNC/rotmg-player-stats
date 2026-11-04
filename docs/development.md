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

- Scheduled scrape: `.github/workflows/scrape.yml`, every 20 minutes.
- Checks out `refs/heads/data` once as the canonical history. The explicit branch ref matters because an older tag is also named `data`.
- Reconciles each CSV with its newest complete release asset. A partial release cannot replace newer canonical history. Invalid rows or conflicting values at the same UTC timestamp fail the run.
- Verifies all historical rows remain, not just that total size grew.
- Commits CSVs and regenerated `daily.json` to `data` before replacing release assets. No force pushes or orphan-branch fallbacks are used.
- Uses bounded retries for transient failures and checks whether an uncertain push already succeeded. If another publisher advanced `data`, the run stops instead of overwriting it.
- Stores CSVs and JSON as a 30-day recovery artifact if a run fails.

### November 4, 2026 recovery

`scripts/recovery/2026-11-04.json` restores 33 exact lost rows per source from the two preserved data commits recorded in that file. It is applied idempotently during baseline preparation, preserving later samples. The restored daily maxima are 38,312 RealmEye players and 2,888 RealmStock players. Samples present only in failed-run logs are not reconstructed with guessed timestamps.

For local pipeline testing, put a checkout of `refs/heads/data` in `.tmp/published-data`, set `GITHUB_REPOSITORY`, and provide normal GitHub CLI access before running `bun run baseline:prepare`. That command reads GitHub but does not publish. `bun run scripts/publish-snapshot.ts` publishes and should only run in the serialized workflow or an explicitly authorized recovery.
