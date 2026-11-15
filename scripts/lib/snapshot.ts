import type { Outcomes } from "./growth";

type Snapshot = { t: string; a: number | null; c: number | null; f: number | null };

/** Keep historical arrays intact while making unavailable current readings explicit. */
export function applySnapshotAvailability<T extends Snapshot>(snapshot: T, outcomes: Outcomes): T {
  // Local aggregation and legacy callers do not supply current-run source outcomes.
  if (Object.values(outcomes).every((outcome) => outcome === undefined)) return snapshot;
  const result = { ...snapshot };
  const fields = { realmeye: "a", realmstock: "c", launcher: "f" } as const;
  for (const source of Object.keys(fields) as Array<keyof typeof fields>) {
    const outcome = outcomes[source];
    if (outcome !== "success" && outcome !== "failure") throw new Error(`Invalid outcome for ${source}: ${outcome}`);
    if (outcome === "failure") result[fields[source]] = null;
  }
  return result;
}
