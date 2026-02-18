import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DailyAggregate = {
  date: string;
  realmeye_max: number | null;
  realmstock_max: number | null;
  launcher_loads: number | null;
};

type CompactDaily = {
  u: string;
  d: string[];
  a: Array<number | null>;
  c: Array<number | null>;
  f: Array<number | null>;
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

type LauncherPoint = {
  timestampMs: number;
  views: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REALMEYE_FALLBACK = resolve(ROOT, "ROTMG Players Active Players Over Time - RealmEyeData.csv");
const REALMEYE_FILE = resolve(ROOT, "data", "realmeye-full.csv");
const REALMSTOCK_FILE = resolve(ROOT, "data", "realmstock-full.csv");
const LAUNCHER_FILE = resolve(ROOT, "data", "launcher-full.csv");
const OUTPUT_FILE = resolve(ROOT, "src", "data", "daily.json");
const LAUNCHER_MIN_DATE = "2024-07-03";
const MAX_INTERPOLATION_GAP_HOURS = 48;

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
    const columns = line.split(",", 3).map((part) => part.trim());
    const rawDate = columns[1];
    const rawPlayers = columns[2];

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

function aggregateMaxByDate(rows: Row[]): Map<string, number> {
  const daily = new Map<string, number>();

  for (const row of rows) {
    const existing = daily.get(row.date);
    if (existing == null || row.players > existing) {
      daily.set(row.date, row.players);
      continue;
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

function dateStartUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function formatUtcDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function normalizeLauncherPoints(rows: LauncherRow[]): LauncherPoint[] {
  const byTimestamp = new Map<number, number>();

  for (const row of rows) {
    if (row.date < LAUNCHER_MIN_DATE) {
      continue;
    }

    const timestampMs = Date.parse(`${row.date}T${row.time}Z`);
    if (!Number.isFinite(timestampMs)) {
      continue;
    }

    const existing = byTimestamp.get(timestampMs);
    if (existing == null || row.views > existing) {
      byTimestamp.set(timestampMs, row.views);
    }
  }

  return Array.from(byTimestamp.entries())
    .map(([timestampMs, views]) => ({ timestampMs, views }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function interpolateLauncherViewsAt(points: LauncherPoint[], targetTimestampMs: number): number | null {
  if (points.length === 0) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return null;
  }

  if (targetTimestampMs < first.timestampMs || targetTimestampMs > last.timestampMs) {
    return null;
  }

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const point = points[mid];
    if (!point) {
      break;
    }

    if (point.timestampMs === targetTimestampMs) {
      return point.views;
    }

    if (point.timestampMs < targetTimestampMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const previous = points[high];
  const next = points[low];

  if (!previous || !next) {
    return null;
  }

  const spanMs = next.timestampMs - previous.timestampMs;
  if (spanMs <= 0) {
    return null;
  }

  const maxGapMs = MAX_INTERPOLATION_GAP_HOURS * 60 * 60 * 1000;
  if (spanMs > maxGapMs) {
    return null;
  }

  const spanViews = next.views - previous.views;
  if (spanViews < 0) {
    return null;
  }

  const ratio = (targetTimestampMs - previous.timestampMs) / spanMs;
  return previous.views + spanViews * ratio;
}

function aggregateLauncherLoads(rows: LauncherRow[]): Map<string, number | null> {
  const points = normalizeLauncherPoints(rows);
  const dailyLoads = new Map<string, number | null>();

  if (points.length < 2) {
    return dailyLoads;
  }

  const firstTimestampMs = points[0]?.timestampMs;
  const lastTimestampMs = points[points.length - 1]?.timestampMs;
  if (firstTimestampMs == null || lastTimestampMs == null) {
    return dailyLoads;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  let dayStartMs = dateStartUtcMs(LAUNCHER_MIN_DATE);

  while (dayStartMs + msPerDay <= lastTimestampMs) {
    const date = formatUtcDate(dayStartMs);
    const dayEndMs = dayStartMs + msPerDay;

    const startViews = interpolateLauncherViewsAt(points, dayStartMs);
    const endViews = interpolateLauncherViewsAt(points, dayEndMs);

    if (startViews == null || endViews == null) {
      dailyLoads.set(date, null);
      dayStartMs = dayEndMs;
      continue;
    }

    const delta = endViews - startViews;
    dailyLoads.set(date, delta >= 0 ? Math.round(delta) : null);

    dayStartMs = dayEndMs;
  }

  return dailyLoads;
}

function mergeDaily(
  realmeyeDaily: Map<string, number>,
  realmstockDaily: Map<string, number>,
  launcherDailyLoads: Map<string, number | null>
): DailyAggregate[] {
  const dates = new Set<string>([...realmeyeDaily.keys(), ...realmstockDaily.keys(), ...launcherDailyLoads.keys()]);

  return Array.from(dates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const realmeye = realmeyeDaily.get(date) ?? null;
      const realmstock = realmstockDaily.get(date) ?? null;
      const launcherLoads = launcherDailyLoads.get(date) ?? null;

      return {
        date,
        realmeye_max: realmeye ?? null,
        realmstock_max: realmstock ?? null,
        launcher_loads: launcherLoads,
      };
    });
}

function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

function toCompactDaily(points: DailyAggregate[], updatedAt: string): CompactDaily {
  return {
    u: updatedAt,
    d: points.map((point) => compactDate(point.date)),
    a: points.map((point) => point.realmeye_max),
    c: points.map((point) => point.realmstock_max),
    f: points.map((point) => point.launcher_loads),
  };
}

function run(): void {
  const realmeyeSource = existsSync(REALMEYE_FILE) ? REALMEYE_FILE : REALMEYE_FALLBACK;
  const realmeyeRows = parseCsvRows(realmeyeSource);
  const realmstockRows = parseCsvRows(REALMSTOCK_FILE);
  const launcherRows = parseLauncherRows(LAUNCHER_FILE);

  const merged = mergeDaily(
    aggregateMaxByDate(realmeyeRows),
    aggregateMaxByDate(realmstockRows),
    aggregateLauncherLoads(launcherRows)
  );
  const compact = toCompactDaily(merged, new Date().toISOString());

  mkdirSync(resolve(ROOT, "src", "data"), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(compact)}\n`, "utf8");

  process.stdout.write(
    `Aggregated ${merged.length} days from ${realmeyeRows.length} RealmEye rows, ${realmstockRows.length} RealmStock rows, and ${launcherRows.length} launcher rows.\n`
  );
}

run();
