import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type BaselineMeta = {
  rows: number;
  bytes: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_DIR = resolve(ROOT, "data");
const META_FILE = resolve(ROOT, ".tmp", "baseline-meta.json");
const FILES = ["realmeye-full.csv", "realmstock-full.csv", "launcher-full.csv"];

function fileRows(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function fileSize(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  return statSync(filePath).size;
}

function verify(): void {
  if (!existsSync(META_FILE)) {
    throw new Error(`Missing baseline metadata at ${META_FILE}`);
  }

  const baseline = JSON.parse(readFileSync(META_FILE, "utf8")) as Record<string, BaselineMeta>;

  for (const fileName of FILES) {
    const meta = baseline[fileName];
    if (!meta) {
      throw new Error(`Missing baseline entry for ${fileName}`);
    }

    const filePath = resolve(DATA_DIR, fileName);
    const rows = fileRows(filePath);
    const bytes = fileSize(filePath);

    if (rows <= meta.rows) {
      throw new Error(`${fileName} row count did not increase (before ${meta.rows}, after ${rows})`);
    }

    if (bytes <= meta.bytes) {
      throw new Error(`${fileName} byte size did not increase (before ${meta.bytes}, after ${bytes})`);
    }

    process.stdout.write(
      `${fileName} grew from ${meta.rows} rows/${meta.bytes} bytes to ${rows} rows/${bytes} bytes\n`
    );
  }
}

verify();
