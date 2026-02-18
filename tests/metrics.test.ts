import { describe, expect, test } from "vitest";
import { buildStats, buildTableRows } from "../src/utils/metrics";
import type { DailyPoint } from "../src/types";

const sample: DailyPoint[] = [
  {
    date: "2026-01-01",
    realmeye_max: 100,
    realmstock_max: 20,
    launcher_loads: null,
  },
  {
    date: "2026-01-02",
    realmeye_max: 130,
    realmstock_max: 22,
    launcher_loads: 1000,
  },
  {
    date: "2026-01-03",
    realmeye_max: 110,
    realmstock_max: null,
    launcher_loads: 1200,
  },
];

describe("buildStats", () => {
  test("computes current, all-time peak, and all-time low", () => {
    const stats = buildStats(sample);
    expect(stats.currentRealmeye).toBe(110);
    expect(stats.allTimePeak.value).toBe(130);
    expect(stats.allTimePeak.date).toBe("2026-01-02");
    expect(stats.allTimeLow.value).toBe(100);
    expect(stats.allTimeLow.date).toBe("2026-01-01");
    expect(stats.lastUpdatedAt).toBe("2026-01-03T00:00:00.000Z");
  });
});

describe("buildTableRows", () => {
  test("adds day-over-day delta", () => {
    const rows = buildTableRows(sample);
    expect(rows[0]?.realmeye_delta).toBeNull();
    expect(rows[1]?.realmeye_delta).toBe(30);
    expect(rows[2]?.realmeye_delta).toBe(-20);
    expect(rows[0]?.launcher_delta).toBeNull();
    expect(rows[1]?.launcher_delta).toBeNull();
    expect(rows[2]?.launcher_delta).toBe(200);
  });
});
