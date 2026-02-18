import type { DailyPoint } from "../types";

export type StatsSummary = {
  currentRealmeye: number | null;
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
