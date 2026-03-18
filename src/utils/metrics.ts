import type { DailyPoint, Snapshot } from "../types";

export type DayComparison = {
  /** The current value — from the snapshot when available, else latest daily entry */
  current: number | null;
  /** Previous day's daily aggregate value for comparison */
  yesterday: number | null;
  /** Absolute delta: current - yesterday. Null if either is unavailable. */
  delta: number | null;
};

export type StatsSummary = {
  currentRealmeye: number | null;
  currentRealmstock: DayComparison;
  launcherLoads24h: DayComparison;
  allTimePeak: { value: number | null; date: string | null };
  allTimeLow: { value: number | null; date: string | null };
  lastUpdatedAt: string | null;
};

export type TableRow = DailyPoint & {
  realmeye_delta: number | null;
  realmstock_delta: number | null;
  launcher_delta: number | null;
};

const MAX_DELTA_GAP_DAYS = 7;

function latestRealmeyeValue(points: DailyPoint[]): number | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point?.realmeye_max != null) {
      return point.realmeye_max;
    }
  }
  return null;
}

function resolveFallbackLastUpdatedAt(points: DailyPoint[]): string | null {
  const latestDate = points[points.length - 1]?.date;
  if (latestDate == null) {
    return null;
  }

  const fallbackTimestamp = Date.parse(`${latestDate}T00:00:00Z`);
  return Number.isFinite(fallbackTimestamp) ? new Date(fallbackTimestamp).toISOString() : null;
}

/**
 * Find the previous day's value from the daily array, looking back up to 2 days
 * to handle occasional missing entries.
 */
function previousDailyValue(
  points: DailyPoint[],
  pick: (p: DailyPoint) => number | null,
  fromIndex: number
): number | null {
  const dayMs = 24 * 60 * 60 * 1000;
  const anchorPoint = points[fromIndex];
  if (anchorPoint == null) return null;
  const anchorDateMs = Date.parse(`${anchorPoint.date}T00:00:00Z`);

  for (let i = fromIndex - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (p == null || pick(p) == null) continue;
    const prevDateMs = Date.parse(`${p.date}T00:00:00Z`);
    const gap = Math.round((anchorDateMs - prevDateMs) / dayMs);
    if (gap <= 2) return pick(p);
    break; // too far back
  }
  return null;
}

function buildDayComparison(
  points: DailyPoint[],
  pick: (p: DailyPoint) => number | null,
  snapshotValue: number | null
): DayComparison {
  // Find index of the latest non-null daily entry for this field.
  let latestIdx = -1;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const pt = points[i];
    if (pt != null && pick(pt) != null) {
      latestIdx = i;
      break;
    }
  }

  // current = snapshot value if available, else latest daily value
  const latestPoint = latestIdx >= 0 ? points[latestIdx] : null;
  const current = snapshotValue ?? (latestPoint != null ? pick(latestPoint) : null);

  // yesterday = the daily entry before the latest
  const yesterday = latestIdx >= 0 ? previousDailyValue(points, pick, latestIdx) : null;

  const delta = current != null && yesterday != null ? current - yesterday : null;

  return { current, yesterday, delta };
}

export function buildStats(
  points: DailyPoint[],
  snapshot: Snapshot | null = null,
  lastUpdatedAt: string | null = null
): StatsSummary {
  const currentRealmeye = snapshot?.a ?? latestRealmeyeValue(points);

  let allTimePeak: { value: number | null; date: string | null } = { value: null, date: null };
  let allTimeLow: { value: number | null; date: string | null } = { value: null, date: null };

  for (const point of points) {
    if (point.realmeye_max == null) continue;

    if (allTimePeak.value == null || point.realmeye_max > allTimePeak.value) {
      allTimePeak = { value: point.realmeye_max, date: point.date };
    }
    if (allTimeLow.value == null || point.realmeye_max < allTimeLow.value) {
      allTimeLow = { value: point.realmeye_max, date: point.date };
    }
  }

  return {
    currentRealmeye,
    currentRealmstock: buildDayComparison(points, (p) => p.realmstock_max, snapshot?.c ?? null),
    launcherLoads24h: buildDayComparison(points, (p) => p.launcher_loads, snapshot?.f ?? null),
    allTimePeak,
    allTimeLow,
    lastUpdatedAt: lastUpdatedAt ?? snapshot?.t ?? resolveFallbackLastUpdatedAt(points),
  };
}

export function buildTableRows(points: DailyPoint[]): TableRow[] {
  const dayMs = 24 * 60 * 60 * 1000;

  const computeDelta = (index: number, pick: (point: DailyPoint) => number | null): number | null => {
    const currentPoint = points[index];
    if (!currentPoint) return null;

    const currentValue = pick(currentPoint);
    if (currentValue == null) return null;

    let previousIndex = index - 1;
    while (previousIndex >= 0) {
      const previousPoint = points[previousIndex];
      if (!previousPoint) break;

      const previousValue = pick(previousPoint);
      if (previousValue == null) {
        previousIndex -= 1;
        continue;
      }

      const currentDateMs = Date.parse(`${currentPoint.date}T00:00:00Z`);
      const previousDateMs = Date.parse(`${previousPoint.date}T00:00:00Z`);
      if (!Number.isFinite(currentDateMs) || !Number.isFinite(previousDateMs)) return null;

      const dayGap = Math.round((currentDateMs - previousDateMs) / dayMs);
      if (dayGap <= 0) return null;

      const totalDelta = currentValue - previousValue;
      if (dayGap === 1) return totalDelta;
      if (dayGap > MAX_DELTA_GAP_DAYS) return null;

      return Math.round(totalDelta / dayGap);
    }

    return null;
  };

  return points.map((point, index) => ({
    ...point,
    realmeye_delta: computeDelta(index, (item) => item.realmeye_max),
    realmstock_delta: computeDelta(index, (item) => item.realmstock_max),
    launcher_delta: computeDelta(index, (item) => item.launcher_loads),
  }));
}
