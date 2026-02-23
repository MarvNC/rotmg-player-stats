import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Spec = {
  fileName: string;
  minBytes: number;
};

type ReleaseAsset = {
  name?: string;
  size?: number;
};

type Release = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
};

type BaselineMeta = {
  rows: number;
  bytes: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_DIR = resolve(ROOT, "data");
const META_FILE = resolve(ROOT, ".tmp", "baseline-meta.json");
const SPECS: Spec[] = [
  { fileName: "realmeye-full.csv", minBytes: 50_000 },
  { fileName: "realmstock-full.csv", minBytes: 150_000 },
  { fileName: "launcher-full.csv", minBytes: 5_000 },
];

function run(command: string[]): string {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdout = Buffer.from(result.stdout).toString("utf8");
  const stderr = Buffer.from(result.stderr).toString("utf8");

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${stderr || stdout}`.trim());
  }

  return stdout;
}

function tryRun(command: string[]): string | null {
  try {
    return run(command);
  } catch {
    return null;
  }
}

function fileSize(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  return statSync(filePath).size;
}

function fileRows(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function releaseHasAllAssets(release: Release): boolean {
  const assets = release.assets ?? [];
  return SPECS.every((spec) => {
    const asset = assets.find((candidate) => candidate.name === spec.fileName);
    return asset != null && typeof asset.size === "number" && asset.size >= spec.minBytes;
  });
}

function pickSourceTag(repository: string): string | null {
  const output = run(["gh", "api", `repos/${repository}/releases?per_page=50`]);
  const releases = JSON.parse(output) as Release[];

  for (const release of releases) {
    if (release.draft || release.prerelease) {
      continue;
    }

    const tag = release.tag_name;
    if (!tag || !/^\d{4}-\d{2}-\d{2}$/.test(tag)) {
      continue;
    }

    if (releaseHasAllAssets(release)) {
      return tag;
    }
  }

  return null;
}

function fetchDataBranchCsv(repository: string, fileName: string): string | null {
  const response = tryRun(["gh", "api", `repos/${repository}/contents/csv/${fileName}?ref=data`]);
  if (!response) {
    return null;
  }

  const payload = JSON.parse(response) as { content?: string; encoding?: string };
  if (payload.encoding !== "base64" || !payload.content) {
    return null;
  }

  return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function prepare(): void {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(resolve(ROOT, ".tmp"), { recursive: true });

  const downloadDir = resolve(ROOT, ".tmp", "baseline-download");
  mkdirSync(downloadDir, { recursive: true });

  const sourceTag = pickSourceTag(repository);
  if (sourceTag) {
    process.stdout.write(`Using release baseline: ${sourceTag}\n`);
    for (const spec of SPECS) {
      tryRun([
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
    }
  } else {
    process.stdout.write("No valid release baseline found, trying data branch fallback.\n");
  }

  const metadata: Record<string, BaselineMeta> = {};

  for (const spec of SPECS) {
    const target = resolve(DATA_DIR, spec.fileName);
    const downloaded = resolve(downloadDir, spec.fileName);

    if (fileSize(downloaded) >= spec.minBytes) {
      copyFileSync(downloaded, target);
    }

    if (fileSize(target) < spec.minBytes) {
      const fromDataBranch = fetchDataBranchCsv(repository, spec.fileName);
      if (fromDataBranch) {
        writeFileSync(target, fromDataBranch, "utf8");
        process.stdout.write(`Recovered ${spec.fileName} from data branch backup.\n`);
      }
    }

    const bytes = fileSize(target);
    if (bytes < spec.minBytes) {
      throw new Error(`No valid baseline for ${spec.fileName}`);
    }

    metadata[spec.fileName] = {
      rows: fileRows(target),
      bytes,
    };
  }

  writeFileSync(META_FILE, `${JSON.stringify(metadata)}\n`, "utf8");
  process.stdout.write(`Wrote baseline metadata to ${META_FILE}\n`);
}

prepare();
