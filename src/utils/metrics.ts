import type { DailyPoint } from "../types";

export type DayComparison = {
  current: number | null;
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

function latestValue(points: DailyPoint[]): number | null {
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

function buildDayComparison(points: DailyPoint[], pick: (p: DailyPoint) => number | null): DayComparison {
  // Find the latest non-null value
  let currentIdx = -1;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (p != null && pick(p) != null) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx === -1) {
    return { current: null, yesterday: null, delta: null };
  }

  const current = pick(points[currentIdx]!);

  // Find the previous non-null value (look back up to 2 days to handle gaps)
  let yesterdayIdx = -1;
  const dayMs = 24 * 60 * 60 * 1000;
  const currentDateMs = Date.parse(`${points[currentIdx]!.date}T00:00:00Z`);

  for (let i = currentIdx - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (p == null || pick(p) == null) {
      continue;
    }
    const prevDateMs = Date.parse(`${p.date}T00:00:00Z`);
    const gap = Math.round((currentDateMs - prevDateMs) / dayMs);
    if (gap <= 2) {
      yesterdayIdx = i;
      break;
    }
    // Too far back — no comparison
    break;
  }

  const yesterday = yesterdayIdx >= 0 ? pick(points[yesterdayIdx]!) : null;
  const delta = current != null && yesterday != null ? current - yesterday : null;

  return { current, yesterday, delta };
}

export function buildStats(points: DailyPoint[], lastUpdatedAt: string | null = null): StatsSummary {
  const current = latestValue(points);

  let allTimePeak: { value: number | null; date: string | null } = {
    value: null,
    date: null,
  };

  let allTimeLow: { value: number | null; date: string | null } = {
    value: null,
    date: null,
  };

  for (const point of points) {
    if (point.realmeye_max == null) {
      continue;
    }

    if (allTimePeak.value == null || point.realmeye_max > allTimePeak.value) {
      allTimePeak = { value: point.realmeye_max, date: point.date };
    }

    if (allTimeLow.value == null || point.realmeye_max < allTimeLow.value) {
      allTimeLow = { value: point.realmeye_max, date: point.date };
    }
  }

  return {
    currentRealmeye: current,
    currentRealmstock: buildDayComparison(points, (p) => p.realmstock_max),
    launcherLoads24h: buildDayComparison(points, (p) => p.launcher_loads),
    allTimePeak,
    allTimeLow,
    lastUpdatedAt: lastUpdatedAt ?? resolveFallbackLastUpdatedAt(points),
  };
}

export function buildTableRows(points: DailyPoint[]): TableRow[] {
  const dayMs = 24 * 60 * 60 * 1000;

  const computeDelta = (index: number, pick: (point: DailyPoint) => number | null): number | null => {
    const currentPoint = points[index];
    if (!currentPoint) {
      return null;
    }

    const currentValue = pick(currentPoint);
    if (currentValue == null) {
      return null;
    }

    let previousIndex = index - 1;
    while (previousIndex >= 0) {
      const previousPoint = points[previousIndex];
      if (!previousPoint) {
        break;
      }

      const previousValue = pick(previousPoint);
      if (previousValue == null) {
        previousIndex -= 1;
        continue;
      }

      const currentDateMs = Date.parse(`${currentPoint.date}T00:00:00Z`);
      const previousDateMs = Date.parse(`${previousPoint.date}T00:00:00Z`);
      if (!Number.isFinite(currentDateMs) || !Number.isFinite(previousDateMs)) {
        return null;
      }

      const dayGap = Math.round((currentDateMs - previousDateMs) / dayMs);
      if (dayGap <= 0) {
        return null;
      }

      const totalDelta = currentValue - previousValue;
      if (dayGap === 1) {
        return totalDelta;
      }

      if (dayGap > MAX_DELTA_GAP_DAYS) {
        return null;
      }

      return Math.round(totalDelta / dayGap);
    }

    return null;
  };

  return points.map((point, index) => {
    return {
      ...point,
      realmeye_delta: computeDelta(index, (item) => item.realmeye_max),
      realmstock_delta: computeDelta(index, (item) => item.realmstock_max),
      launcher_delta: computeDelta(index, (item) => item.launcher_loads),
    };
  });
}
