import type { CompactDaily, DailyPoint } from "../types";
import { LAUNCHER_EXCLUDED_DATES, REALMSTOCK_EXCLUDED_DATES } from "./knownOutliers";

function expandDate(compactDate: string): string {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

export function decodeDailyData(compact: CompactDaily): DailyPoint[] {
  return compact.d.map((compactDate, index) => {
    const date = expandDate(compactDate);
    return {
      date,
      realmeye_max: compact.a[index] ?? null,
      realmstock_max: REALMSTOCK_EXCLUDED_DATES.has(date) ? null : (compact.c[index] ?? null),
      launcher_loads: LAUNCHER_EXCLUDED_DATES.has(date) ? null : (compact.f[index] ?? null),
    };
  });
}
