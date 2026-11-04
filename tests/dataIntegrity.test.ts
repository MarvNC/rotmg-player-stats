import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assertContainsCsv, mergeCsv, parseCsv } from "../scripts/lib/csv";
import { pickSourceTag, prepareBaseline, SPECS, type Release } from "../scripts/lib/baseline";
import { retry, type Run } from "../scripts/lib/commands";
import { publishSnapshot } from "../scripts/lib/publish";
import recovery from "../scripts/recovery/2026-11-04.json";

const oldRow = "00:00:00,2026-11-03,100";
const newRow = "00:00:00,2026-11-04,200";
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function fixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), "rotmg-test-"));
  directories.push(root);
  mkdirSync(resolve(root, ".tmp/published-data/csv"), { recursive: true });
  mkdirSync(resolve(root, "data"), { recursive: true });
  mkdirSync(resolve(root, "src/data"), { recursive: true });
  const rows =
    Array.from({ length: 7000 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 0, 1) + index * 60_000).toISOString();
      return `${date.slice(11, 19)},${date.slice(0, 10)},12345`;
    }).join("\n") + "\n";
  for (const { fileName } of SPECS)
    writeFileSync(resolve(root, ".tmp/published-data/csv", fileName), rows + newRow + "\n");
  return root;
}

describe("CSV history integrity", () => {
  it("unions old releases with newer canonical data and sorts/deduplicates", () => {
    expect(mergeCsv([newRow + "\n" + oldRow, oldRow])).toBe(oldRow + "\n" + newRow + "\n");
  });
  it("rejects conflicts rather than choosing a winner", () => {
    expect(() => mergeCsv([oldRow, oldRow.replace("100", "101")])).toThrow("Conflicting");
  });
  it.each([
    "00:00:00,2026-02-30,1",
    "25:00:00,2026-11-04,1",
    "00:00:00,2026-11-04,-1",
    "00:00:00,2026-11-04,9007199254740992",
    "garbage",
  ])("rejects invalid row %s", (row) => {
    expect(() => parseCsv(row)).toThrow();
  });
  it("detects lost or replaced history even if total row count increases", () => {
    expect(() => assertContainsCsv(oldRow, newRow + "\n00:01:00,2026-11-04,300")).toThrow("missing or changed");
    expect(() => assertContainsCsv(oldRow, oldRow.replace("100", "101") + "\n" + newRow)).toThrow("missing or changed");
  });
  it("recovers 33 exact samples per source idempotently with expected maxima", () => {
    for (const { fileName } of SPECS) {
      const rows = recovery.files[fileName];
      expect(rows).toHaveLength(33);
      expect(parseCsv(rows.join("\n")).size).toBe(33);
      const once = mergeCsv([rows.join("\n")]);
      expect(mergeCsv([once, rows.join("\n")])).toBe(once);
    }
    expect(Math.max(...recovery.files["realmeye-full.csv"].map((row) => Number(row.split(",")[2])))).toBe(38312);
    expect(Math.max(...recovery.files["realmstock-full.csv"].map((row) => Number(row.split(",")[2])))).toBe(2888);
  });
});

describe("baseline preparation", () => {
  it("uses an intact asset from a partial newest release", () => {
    const releases: Release[] = [
      { tag_name: "2026-11-03", assets: [{ name: "a.csv", size: 100, state: "uploaded" }] },
      { tag_name: "2026-11-04", assets: [{ name: "a.csv", size: 110, state: "uploaded" }] },
    ];
    expect(pickSourceTag(releases, "a.csv", 50)).toBe("2026-11-04");
    expect(pickSourceTag(releases, "missing.csv", 50)).toBeNull();
    releases[1].assets![0].state = "starter";
    expect(pickSourceTag(releases, "a.csv", 50)).toBe("2026-11-03");
  });
  it("keeps canonical rows when release assets are absent and restores exact history", () => {
    const root = fixture();
    const run: Run = (command) => (command[0] === "git" ? "pinned-head" : "[]");
    prepareBaseline(root, "owner/repo", run);
    for (const { fileName } of SPECS) {
      const csv = readFileSync(resolve(root, "data", fileName), "utf8");
      expect(parseCsv(csv).size).toBe(7034);
      assertContainsCsv(readFileSync(resolve(root, ".tmp/published-data/csv", fileName), "utf8"), csv);
      assertContainsCsv(recovery.files[fileName].join("\n"), csv);
    }
  });
  it("fails closed when the canonical checkout is unavailable", () => {
    const root = fixture();
    const run = vi.fn<Run>(() => {
      throw new Error("canonical checkout unavailable");
    });
    expect(() => prepareBaseline(root, "owner/repo", run)).toThrow("canonical checkout unavailable");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("merges an older release without replacing canonical history", () => {
    const root = fixture();
    const run: Run = (command) => {
      if (command[0] === "git") return "pinned-head";
      if (command[1] === "api")
        return JSON.stringify([
          { tag_name: "2026-11-03", assets: SPECS.map((s) => ({ name: s.fileName, size: 200000, state: "uploaded" })) },
        ]);
      const fileName = command[command.indexOf("-p") + 1];
      const canonical = readFileSync(resolve(root, ".tmp/published-data/csv", fileName), "utf8");
      writeFileSync(resolve(root, ".tmp/baseline-download", fileName), canonical.replace(newRow + "\n", oldRow + "\n"));
      return "";
    };
    prepareBaseline(root, "owner/repo", run);
    for (const { fileName } of SPECS)
      assertContainsCsv(oldRow + "\n" + newRow, readFileSync(resolve(root, "data", fileName), "utf8"));
  });
});

describe("publication safeguards", () => {
  it("refuses an advanced remote without pushing", () => {
    const root = fixture();
    writeFileSync(resolve(root, ".tmp/published-head"), "old-head");
    const run = vi.fn<Run>((command) => (command[1] === "rev-parse" ? "old-head" : "new-head\trefs/heads/data"));
    expect(() => publishSnapshot(root, run)).toThrow("changed during the scrape");
    expect(run.mock.calls.some(([command]) => command.includes("push"))).toBe(false);
  });
  it.each(["accepted", "accepted-last", "advanced", "unchanged"] as const)(
    "handles uncertain pushes when remote is %s",
    (outcome) => {
      const root = fixture();
      writeFileSync(resolve(root, ".tmp/published-head"), "old-head");
      for (const { fileName } of SPECS) {
        const csv = readFileSync(resolve(root, ".tmp/published-data/csv", fileName), "utf8");
        writeFileSync(resolve(root, "data", fileName), csv + "00:01:00,2026-11-04,201\n");
      }
      writeFileSync(resolve(root, "src/data/daily.json"), "{}");
      let committed = false;
      let remote = "old-head";
      let pushes = 0;
      const run: Run = (command) => {
        if (command[1] === "rev-parse") return committed ? "our-commit" : "old-head";
        if (command[1] === "ls-remote") return remote + "\trefs/heads/data";
        if (command[1] === "diff") return "csv/realmeye-full.csv";
        if (command.includes("commit")) {
          committed = true;
          return "";
        }
        if (command[1] === "push") {
          pushes += 1;
          if (outcome === "accepted-last") {
            if (pushes === 3) remote = "our-commit";
            throw new Error("connection lost");
          }
          if (pushes === 1) {
            remote = outcome === "accepted" ? "our-commit" : outcome === "advanced" ? "other-commit" : "old-head";
            throw new Error("connection lost");
          }
          remote = "our-commit";
        }
        return "";
      };
      if (outcome === "advanced") expect(() => publishSnapshot(root, run, () => {})).toThrow("advanced");
      else publishSnapshot(root, run, () => {});
      expect(pushes).toBe(outcome === "accepted-last" ? 3 : outcome === "unchanged" ? 2 : 1);
    }
  );
  it("refuses to publish a candidate that loses canonical history", () => {
    const root = fixture();
    writeFileSync(resolve(root, ".tmp/published-head"), "old-head");
    writeFileSync(resolve(root, "data/realmeye-full.csv"), oldRow);
    const run = vi.fn<Run>((command) => (command[1] === "rev-parse" ? "old-head" : "old-head\trefs/heads/data"));
    expect(() => publishSnapshot(root, run)).toThrow("missing or changed");
    expect(run.mock.calls.some(([command]) => command.includes("push"))).toBe(false);
  });
  it("bounds retries and succeeds after a transient failure", () => {
    let attempts = 0;
    const sleep = vi.fn();
    expect(
      retry(() => {
        if (++attempts < 3) throw new Error("temporary");
        return "ok";
      }, sleep)
    ).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep.mock.calls).toEqual([[2000], [4000]]);
    const operation = vi.fn(() => {
      throw new Error("permanent");
    });
    expect(() => retry(operation, sleep)).toThrow("permanent");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
