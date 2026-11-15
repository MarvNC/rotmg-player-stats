import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { assertContainsCsv, parseCsv } from "./csv";

export const SOURCES = ["realmeye", "realmstock", "launcher"] as const;
export type Source = (typeof SOURCES)[number];
export type Outcomes = Record<Source, string | undefined>;

/** A failed source must remain unchanged; a successful source must add valid data. */
export function verifyGrowth(root: string, outcomes?: Outcomes): void {
  const baseline = JSON.parse(readFileSync(resolve(root, ".tmp/baseline-meta.json"), "utf8")) as Record<
    string,
    { rows: number; bytes: number }
  >;
  let successes = 0;
  for (const source of SOURCES) {
    const outcome = outcomes ? outcomes[source] : "success";
    if (outcome !== "success" && outcome !== "failure") throw new Error(`Invalid outcome for ${source}: ${outcome}`);
    const fileName = `${source}-full.csv`;
    const meta = baseline[fileName];
    if (!meta) throw new Error(`Missing baseline entry for ${fileName}`);
    const before = readFileSync(resolve(root, ".tmp/baseline-csv", fileName), "utf8");
    const filePath = resolve(root, "data", fileName);
    const after = readFileSync(filePath, "utf8");
    assertContainsCsv(before, after);
    const rows = parseCsv(after).size;
    const bytes = statSync(filePath).size;
    if (outcome === "failure") {
      if (after !== before) throw new Error(`Failed source ${source} changed its baseline`);
      process.stdout.write(`${source} unavailable; retaining ${rows} historical rows without filling gaps\n`);
      continue;
    }
    if (rows <= meta.rows || bytes <= meta.bytes) throw new Error(`${fileName} did not grow after a successful scrape`);
    successes += 1;
    process.stdout.write(
      `${fileName} grew from ${meta.rows} rows/${meta.bytes} bytes to ${rows} rows/${bytes} bytes\n`
    );
  }
  if (!successes) throw new Error("All sources failed; refusing to publish a fresh-looking stale snapshot");
}
