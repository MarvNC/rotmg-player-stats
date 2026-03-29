import { describe, expect, test } from "vitest";
import type { CompactDaily } from "../src/types";
import { decodeDailyData } from "../src/utils/decodeDailyData";

/** Minimal compact payload covering a known-outlier date for each metric. */
const compact: CompactDaily = {
  d: [
    "20250211", // day before realmstock outlier
    "20250212", // realmstock known outlier
    "20250213", // day after realmstock outlier
    "20260322", // day before launcher outage
    "20260323", // launcher known outlier (imgur API outage)
    "20260324", // launcher known outlier (imgur API outage)
    "20260325", // day after launcher outage
  ],
  a: [3000, 3000, 3000, 20000, 20000, 20000, 20000],
  c: [3424, 281, 3337, null, null, null, null],
  f: [null, null, null, 20364, 6622, 3550, 21527],
};

describe("decodeDailyData", () => {
  test("preserves normal values unchanged", () => {
    const points = decodeDailyData(compact);
    expect(points[0]?.realmstock_max).toBe(3424);
    expect(points[2]?.realmstock_max).toBe(3337);
    expect(points[3]?.launcher_loads).toBe(20364);
    expect(points[6]?.launcher_loads).toBe(21527);
  });

  test("suppresses realmstock outlier on 2025-02-12", () => {
    const points = decodeDailyData(compact);
    const outlier = points.find((p) => p.date === "2025-02-12");
    expect(outlier).toBeDefined();
    expect(outlier?.realmstock_max).toBeNull();
  });

  test("suppresses launcher loads on 2026-03-23 (imgur API outage)", () => {
    const points = decodeDailyData(compact);
    const outlier = points.find((p) => p.date === "2026-03-23");
    expect(outlier).toBeDefined();
    expect(outlier?.launcher_loads).toBeNull();
  });

  test("suppresses launcher loads on 2026-03-24 (imgur API outage)", () => {
    const points = decodeDailyData(compact);
    const outlier = points.find((p) => p.date === "2026-03-24");
    expect(outlier).toBeDefined();
    expect(outlier?.launcher_loads).toBeNull();
  });

  test("does not suppress other metrics on outlier dates", () => {
    const points = decodeDailyData(compact);
    // realmeye_max should be unaffected on the realmstock outlier date
    const rsOutlier = points.find((p) => p.date === "2025-02-12");
    expect(rsOutlier?.realmeye_max).toBe(3000);
    // realmstock_max should be unaffected on the launcher outlier dates
    const lOutlier = points.find((p) => p.date === "2026-03-23");
    expect(lOutlier?.realmstock_max).toBeNull(); // was already null in source data
  });
});
