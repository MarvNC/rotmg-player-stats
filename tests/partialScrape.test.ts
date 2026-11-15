import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SOURCES, verifyGrowth, type Outcomes } from "../scripts/lib/growth";

const roots: string[] = [];
const oldRow = "00:00:00,2026-11-15,123\n";
const newRow = "00:20:00,2026-11-15,124\n";
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture(outcomes: Outcomes): string {
  const root = mkdtempSync(resolve(tmpdir(), "rotmg-partial-"));
  roots.push(root);
  mkdirSync(resolve(root, "data"));
  mkdirSync(resolve(root, ".tmp/baseline-csv"), { recursive: true });
  const meta: Record<string, { rows: number; bytes: number }> = {};
  for (const source of SOURCES) {
    const file = `${source}-full.csv`;
    writeFileSync(resolve(root, ".tmp/baseline-csv", file), oldRow);
    writeFileSync(resolve(root, "data", file), oldRow + (outcomes[source] === "success" ? newRow : ""));
    meta[file] = { rows: 1, bytes: Buffer.byteLength(oldRow) };
  }
  writeFileSync(resolve(root, ".tmp/baseline-meta.json"), JSON.stringify(meta));
  return root;
}
describe("partial source verification", () => {
  it.each(SOURCES)("publishes healthy sources when %s fails", (failed) => {
    const outcomes = Object.fromEntries(SOURCES.map((s) => [s, s === failed ? "failure" : "success"])) as Outcomes;
    expect(() => verifyGrowth(fixture(outcomes), outcomes)).not.toThrow();
  });
  it("accepts just one healthy source", () => {
    const outcomes = { realmeye: "success", realmstock: "failure", launcher: "failure" };
    expect(() => verifyGrowth(fixture(outcomes), outcomes)).not.toThrow();
  });
  it("fails if all sources fail", () => {
    const outcomes = { realmeye: "failure", realmstock: "failure", launcher: "failure" };
    expect(() => verifyGrowth(fixture(outcomes), outcomes)).toThrow("All sources failed");
  });
  it("rejects data appended by a failed scrape", () => {
    const outcomes = { realmeye: "success", realmstock: "failure", launcher: "success" };
    const root = fixture(outcomes);
    writeFileSync(resolve(root, "data/realmstock-full.csv"), oldRow + newRow);
    expect(() => verifyGrowth(root, outcomes)).toThrow("changed its baseline");
  });
  it("rejects history loss and success without growth", () => {
    const outcomes = { realmeye: "success", realmstock: "failure", launcher: "success" };
    const root = fixture(outcomes);
    writeFileSync(resolve(root, "data/realmeye-full.csv"), newRow);
    expect(() => verifyGrowth(root, outcomes)).toThrow("missing or changed");
    writeFileSync(resolve(root, "data/realmeye-full.csv"), oldRow);
    expect(() => verifyGrowth(root, outcomes)).toThrow("did not grow");
  });
  it("rejects missing or skipped outcomes", () => {
    const outcomes = { realmeye: "success", realmstock: "failure", launcher: "success" };
    const root = fixture(outcomes);
    expect(() => verifyGrowth(root, { ...outcomes, launcher: undefined })).toThrow("Invalid outcome");
    expect(() => verifyGrowth(root, { ...outcomes, launcher: "skipped" })).toThrow("Invalid outcome");
  });
  it("retains strict local verification by default", () => {
    const root = fixture({ realmeye: "success", realmstock: "failure", launcher: "success" });
    expect(() => verifyGrowth(root)).toThrow("did not grow");
  });
  it("keeps workflow sources independent with bounded execution and outcome validation", () => {
    const workflow = readFileSync(new URL("../.github/workflows/scrape.yml", import.meta.url), "utf8");
    for (const source of SOURCES) {
      expect(workflow).toContain(`id: ${source}\n        continue-on-error: true\n        timeout-minutes: 2`);
      expect(workflow).toContain(`steps.${source}.outcome`);
    }
    expect(workflow.indexOf("Verify CSV growth")).toBeLessThan(workflow.indexOf("Publish canonical data snapshot"));
  });
});
