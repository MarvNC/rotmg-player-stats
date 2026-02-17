import type { DailyPoint, DateRange } from "../types";

export type RangePreset = "1M" | "6M" | "1Y" | "2Y" | "ALL";

function shiftDate(date: string, years = 0, months = 0): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return parsed.toISOString().slice(0, 10);
}

export function resolvePresetRange(points: DailyPoint[], preset: RangePreset): DateRange {
  if (points.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }

  const start = points[0]?.date ?? "";
  const end = points[points.length - 1]?.date ?? "";

  if (preset === "ALL") {
    return { start, end };
  }

  if (preset === "1Y") {
    return { start: shiftDate(end, -1, 0), end };
  }

  if (preset === "2Y") {
    return { start: shiftDate(end, -2, 0), end };
  }

  if (preset === "6M") {
    return { start: shiftDate(end, 0, -6), end };
  }

  return { start: shiftDate(end, 0, -1), end };
}

export function filterByRange(points: DailyPoint[], range: DateRange): DailyPoint[] {
  return points.filter((point) => point.date >= range.start && point.date <= range.end);
}
