import { describe, expect, it } from "vitest";
import { applySnapshotAvailability } from "../scripts/lib/snapshot";
import type { Outcomes } from "../scripts/lib/growth";

const snapshot = { t: "2026-11-15T12:00:00.000Z", a: 37000, c: 1918, f: 12000 };
const healthy = { realmeye: "success", realmstock: "success", launcher: "success" };
describe("snapshot source availability", () => {
  it.each([
    ["realmeye", "a"],
    ["realmstock", "c"],
    ["launcher", "f"],
  ] as const)("does not relabel old %s values as current", (source, field) => {
    const result = applySnapshotAvailability(snapshot, { ...healthy, [source]: "failure" });
    expect(result).toEqual({ ...snapshot, [field]: null });
    expect(snapshot[field]).not.toBeNull();
  });
  it("preserves healthy snapshots and local defaults", () => {
    expect(applySnapshotAvailability(snapshot, healthy)).toEqual(snapshot);
    expect(
      applySnapshotAvailability(snapshot, { realmeye: undefined, realmstock: undefined, launcher: undefined })
    ).toEqual(snapshot);
  });
  it("rejects partial or invalid outcome declarations", () => {
    expect(() => applySnapshotAvailability(snapshot, { ...healthy, launcher: undefined })).toThrow("Invalid outcome");
    expect(() => applySnapshotAvailability(snapshot, { ...healthy, launcher: "skipped" } as Outcomes)).toThrow(
      "Invalid outcome"
    );
  });
});
