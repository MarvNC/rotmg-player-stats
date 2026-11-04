import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import recovery from "../recovery/2026-11-04.json";
import { assertContainsCsv, mergeCsv, parseCsv } from "./csv";
import { retry, type Run } from "./commands";

export const SPECS = [
  { fileName: "realmeye-full.csv", minBytes: 50_000 },
  { fileName: "realmstock-full.csv", minBytes: 150_000 },
  { fileName: "launcher-full.csv", minBytes: 5_000 },
] as const;

export type Release = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: Array<{ name?: string; size?: number; state?: string }>;
};

/** A partially uploaded release can still contain unique rows in an intact asset. */
export function pickSourceTag(releases: Release[], fileName: string, minBytes: number): string | null {
  const candidates = releases
    .filter((release) => !release.draft && !release.prerelease && /^\d{4}-\d{2}-\d{2}$/.test(release.tag_name ?? ""))
    .sort((a, b) => (b.tag_name ?? "").localeCompare(a.tag_name ?? ""));
  for (const release of candidates) {
    const asset = release.assets?.find((asset) => asset.name === fileName);
    if (asset && asset.state === "uploaded" && (asset.size ?? 0) >= minBytes) return release.tag_name ?? null;
  }
  return null;
}

export function prepareBaseline(root: string, repository: string, run: Run): void {
  const dataDir = resolve(root, "data");
  const publishedDir = resolve(root, ".tmp/published-data");
  const baselineDir = resolve(root, ".tmp/baseline-csv");
  const downloadDir = resolve(root, ".tmp/baseline-download");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(baselineDir, { recursive: true });
  rmSync(downloadDir, { recursive: true, force: true });
  mkdirSync(downloadDir, { recursive: true });

  // The workflow checks out refs/heads/data once. Never treat a failed read as an empty archive.
  const publishedHead = run(["git", "rev-parse", "HEAD"], publishedDir).trim();
  writeFileSync(resolve(root, ".tmp/published-head"), `${publishedHead}\n`);
  const releases = JSON.parse(retry(() => run(["gh", "api", `repos/${repository}/releases?per_page=50`]))) as Release[];
  const metadata: Record<string, { rows: number; bytes: number }> = {};

  for (const spec of SPECS) {
    const publishedPath = resolve(publishedDir, "csv", spec.fileName);
    const published = readFileSync(publishedPath, "utf8");
    if (statSync(publishedPath).size < spec.minBytes) throw new Error(`Invalid published baseline: ${spec.fileName}`);
    const inputs = [published];
    const sourceTag = pickSourceTag(releases, spec.fileName, spec.minBytes);
    if (sourceTag) {
      const downloaded = resolve(downloadDir, spec.fileName);
      retry(() => {
        rmSync(downloaded, { force: true });
        run([
          "gh",
          "release",
          "download",
          sourceTag,
          "-R",
          repository,
          "-D",
          downloadDir,
          "-p",
          spec.fileName,
          "--clobber",
        ]);
        if (statSync(downloaded).size < spec.minBytes) throw new Error(`Incomplete release asset: ${spec.fileName}`);
      });
      inputs.push(readFileSync(downloaded, "utf8"));
      process.stdout.write(`Reconciling ${spec.fileName} with release ${sourceTag} and data ${publishedHead}\n`);
    }
    // Auditable, exact rows from preserved commits. Repeated application is a no-op.
    inputs.push(recovery.files[spec.fileName].join("\n"));
    const merged = mergeCsv(inputs);
    assertContainsCsv(published, merged);
    const target = resolve(dataDir, spec.fileName);
    writeFileSync(target, merged);
    copyFileSync(target, resolve(baselineDir, spec.fileName));
    metadata[spec.fileName] = { rows: parseCsv(merged).size, bytes: Buffer.byteLength(merged) };
  }
  writeFileSync(resolve(root, ".tmp/baseline-meta.json"), `${JSON.stringify(metadata)}\n`);
}
