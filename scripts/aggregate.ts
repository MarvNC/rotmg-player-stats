import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DailyAggregate = {
  date: string;
  realmeye_max: number | null;
  realmeye_min: number | null;
  realmstock_max: number | null;
  realmstock_min: number | null;
  launcher_loads: number | null;
};

type Row = {
  date: string;
  players: number;
};

type LauncherRow = {
  time: string;
  date: string;
  views: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REALMEYE_FALLBACK = resolve(
  ROOT,
  "ROTMG Players Active Players Over Time - RealmEyeData.csv"
);
const REALMEYE_FILE = resolve(ROOT, "data", "realmeye-full.csv");
const REALMSTOCK_FILE = resolve(ROOT, "data", "realmstock-full.csv");
const LAUNCHER_FILE = resolve(ROOT, "data", "launcher-full.csv");
const OUTPUT_FILE = resolve(ROOT, "src", "data", "daily.json");
const LAUNCHER_MIN_DATE = "2024-07-03";

function parseCsvRows(inputPath: string): Row[] {
  if (!existsSync(inputPath)) {
    return [];
  }

  const lines = readFileSync(inputPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Row[] = [];

  for (const line of lines) {
    const [_, rawDate, rawPlayers] = line.split(",", 3).map((part) => part.trim());
    if (!rawDate || !rawPlayers) {
      continue;
    }

    const players = Number.parseInt(rawPlayers, 10);
    if (!Number.isFinite(players)) {
      continue;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      continue;
    }

    rows.push({ date: rawDate, players });
  }

  return rows;
}

function aggregateByDate(rows: Row[]): Map<string, { min: number; max: number }> {
  const daily = new Map<string, { min: number; max: number }>();

  for (const row of rows) {
    const existing = daily.get(row.date);
    if (!existing) {
      daily.set(row.date, { min: row.players, max: row.players });
      continue;
    }

    if (row.players < existing.min) {
      existing.min = row.players;
    }
    if (row.players > existing.max) {
      existing.max = row.players;
    }
  }

  return daily;
}

function parseLauncherRows(inputPath: string): LauncherRow[] {
  if (!existsSync(inputPath)) {
    return [];
  }

  const lines = readFileSync(inputPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: LauncherRow[] = [];

  for (const line of lines) {
    const [rawTime, rawDate, rawViews] = line.split(",", 3).map((part) => part.trim());

    if (!rawTime || !rawDate || !rawViews) {
      continue;
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(rawTime) || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      continue;
    }

    const views = Number.parseInt(rawViews, 10);
    if (!Number.isFinite(views) || views < 0) {
      continue;
    }

    rows.push({ time: rawTime, date: rawDate, views });
  }

  return rows;
}

function daysBetween(previousDate: string, nextDate: string): number {
  const previous = Date.parse(`${previousDate}T00:00:00Z`);
  const next = Date.parse(`${nextDate}T00:00:00Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((next - previous) / msPerDay);
}

function aggregateLauncherLoads(rows: LauncherRow[]): Map<string, number | null> {
  const dailyMax = new Map<string, number>();

  for (const row of rows) {
    if (row.date < LAUNCHER_MIN_DATE) {
      continue;
    }

    const existing = dailyMax.get(row.date);
    if (existing == null || row.views > existing) {
      dailyMax.set(row.date, row.views);
    }
  }

  const dates = Array.from(dailyMax.keys()).sort((a, b) => a.localeCompare(b));
  const dailyLoads = new Map<string, number | null>();

  for (let index = 0; index < dates.length; index += 1) {
    const currentDate = dates[index];
    const currentMax = dailyMax.get(currentDate);

    if (currentMax == null) {
      continue;
    }

    if (index === 0) {
      dailyLoads.set(currentDate, null);
      continue;
    }

    const previousDate = dates[index - 1];
    const previousMax = dailyMax.get(previousDate);
    if (previousMax == null) {
      dailyLoads.set(currentDate, null);
      continue;
    }

    if (daysBetween(previousDate, currentDate) !== 1) {
      dailyLoads.set(currentDate, null);
      continue;
    }

    const loads = currentMax - previousMax;
    dailyLoads.set(currentDate, loads >= 0 ? loads : null);
  }

  return dailyLoads;
}

function mergeDaily(
  realmeyeDaily: Map<string, { min: number; max: number }>,
  realmstockDaily: Map<string, { min: number; max: number }>,
  launcherDailyLoads: Map<string, number | null>
): DailyAggregate[] {
  const dates = new Set<string>([
    ...realmeyeDaily.keys(),
    ...realmstockDaily.keys(),
    ...launcherDailyLoads.keys()
  ]);

  return Array.from(dates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const realmeye = realmeyeDaily.get(date) ?? null;
      const realmstock = realmstockDaily.get(date) ?? null;
      const launcherLoads = launcherDailyLoads.get(date) ?? null;

      return {
        date,
        realmeye_max: realmeye?.max ?? null,
        realmeye_min: realmeye?.min ?? null,
        realmstock_max: realmstock?.max ?? null,
        realmstock_min: realmstock?.min ?? null,
        launcher_loads: launcherLoads
      };
    });
}

function run(): void {
  const realmeyeSource = existsSync(REALMEYE_FILE) ? REALMEYE_FILE : REALMEYE_FALLBACK;
  const realmeyeRows = parseCsvRows(realmeyeSource);
  const realmstockRows = parseCsvRows(REALMSTOCK_FILE);
  const launcherRows = parseLauncherRows(LAUNCHER_FILE);

  const merged = mergeDaily(
    aggregateByDate(realmeyeRows),
    aggregateByDate(realmstockRows),
    aggregateLauncherLoads(launcherRows)
  );

  mkdirSync(resolve(ROOT, "src", "data"), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  process.stdout.write(
    `Aggregated ${merged.length} days from ${realmeyeRows.length} RealmEye rows, ${realmstockRows.length} RealmStock rows, and ${launcherRows.length} launcher rows.\n`
  );
}

run();
