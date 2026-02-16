# RotMG Player Stats

Static React dashboard for historical Realm of the Mad God player counts.

## Stack

- Bun + Vite + React + TypeScript
- uPlot for time-series charts
- TanStack Table + TanStack Virtual for customizable virtualized table view

## Local Development

```bash
bun install
bun run migrate:realmeye
bun run migrate:realmstock
bun run aggregate
bun run dev
```

## Scripts

- `bun run scrape` - Scrape RealmEye and RealmStock and append CSV rows.
- `bun run scrape:dry-run` - Validate live fetch/parsing without appending CSV rows.
- `bun run aggregate` - Aggregate full CSV files into `src/data/daily.json`.
- `bun run migrate:realmeye` - Convert the historical source CSV into release-format CSV.
- `bun run migrate:realmstock` - Convert RealmStock historical source CSV into release-format CSV.
- `bun run test` - Run unit tests.
- `bun run build` - Type-check and build production assets.
