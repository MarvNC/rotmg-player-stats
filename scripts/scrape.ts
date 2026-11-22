import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRealmEyeCount } from "./lib/realmeye";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_DIR = resolve(ROOT, "data");
const REALMEYE_FILE = resolve(DATA_DIR, "realmeye-full.csv");
const REALMSTOCK_FILE = resolve(DATA_DIR, "realmstock-full.csv");
const LAUNCHER_FILE = resolve(DATA_DIR, "launcher-full.csv");
const IMGUR_POST_ID = "ovCN2lM";
const IMGUR_ANON_CLIENT_ID = "546c25a59c58ad7";

type Source = "realmeye" | "realmstock" | "launcher";

const ALL_SOURCES: Source[] = ["realmeye", "realmstock", "launcher"];

function parseArgs(argv: string[]): { dryRun: boolean; strict: boolean; sources: Set<Source> } {
  const dryRun = argv.includes("--dry-run");
  const strict = argv.includes("--strict");
  const sources = new Set<Source>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) {
      continue;
    }

    if (current === "--source") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --source. Expected one of: realmeye, realmstock, launcher");
      }

      if (next === "realmeye" || next === "realmstock" || next === "launcher") {
        sources.add(next);
        index += 1;
        continue;
      }

      throw new Error(`Invalid --source value: ${next}. Expected one of: realmeye, realmstock, launcher`);
    }

    if (current.startsWith("--source=")) {
      const value = current.slice("--source=".length);
      if (value === "realmeye" || value === "realmstock" || value === "launcher") {
        sources.add(value);
        continue;
      }

      throw new Error(`Invalid --source value: ${value}. Expected one of: realmeye, realmstock, launcher`);
    }
  }

  if (sources.size === 0) {
    for (const source of ALL_SOURCES) {
      sources.add(source);
    }
  }

  return { dryRun, strict, sources };
}

const ARGS = parseArgs(process.argv.slice(2));
const IS_DRY_RUN = ARGS.dryRun;
const IS_STRICT = ARGS.strict;
const SELECTED_SOURCES = ARGS.sources;

function ensureDataFiles(): void {
  mkdirSync(DATA_DIR, { recursive: true });

  if (!existsSync(REALMEYE_FILE)) {
    writeFileSync(REALMEYE_FILE, "", "utf8");
  }
  if (!existsSync(REALMSTOCK_FILE)) {
    writeFileSync(REALMSTOCK_FILE, "", "utf8");
  }
  if (!existsSync(LAUNCHER_FILE)) {
    writeFileSync(LAUNCHER_FILE, "", "utf8");
  }
}

function nowUtcParts(): { time: string; date: string } {
  const now = new Date();
  const time = now.toISOString().slice(11, 19);
  const date = now.toISOString().slice(0, 10);
  return { time, date };
}

function appendRow(file: string, players: number): void {
  if (IS_DRY_RUN) {
    return;
  }

  const { date, time } = nowUtcParts();
  appendFileSync(file, `${time},${date},${players}\n`, "utf8");
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

async function scrapeRealmStock(): Promise<number> {
  const response = await fetch("https://realmstock.network/Public/PlayersOnline", {
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`RealmStock request failed with ${response.status}`);
  }

  const body = await response.text();
  const parsed = Number.parseInt(body.replace(/[^0-9]/g, ""), 10);

  if (!Number.isFinite(parsed)) {
    throw new Error("RealmStock response did not contain a numeric player count");
  }

  return parsed;
}

async function scrapeRealmEye(): Promise<number> {
  const response = await fetch("https://www.realmeye.com/number-of-active-players-by-rank", {
    signal: AbortSignal.timeout(30_000),
    headers: {
      "User-Agent": "rotmg-active-players-bot/1.0",
      Accept: "text/html",
    },
  });

  return readRealmEyeCount(response);
}

async function scrapeImgurLauncher(): Promise<number> {
  const response = await fetch(`https://imgur.com/${IMGUR_POST_ID}`, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      "User-Agent": "rotmg-active-players-bot/1.0",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`Imgur request failed with ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/([\d,]+)\s+Views/i);

  if (match?.[1]) {
    const views = Number.parseInt(match[1].replace(/,/g, ""), 10);
    if (Number.isFinite(views)) {
      return views;
    }
  }

  const apiResponse = await fetch(`https://api.imgur.com/post/v1/media/${IMGUR_POST_ID}?include=media,account`, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Client-ID ${IMGUR_ANON_CLIENT_ID}`,
      Accept: "application/json",
    },
  });

  if (!apiResponse.ok) {
    throw new Error(`Imgur API fallback failed with ${apiResponse.status}`);
  }

  const apiBody = (await apiResponse.json()) as { view_count?: unknown };
  const views = parseNonNegativeInteger(apiBody.view_count);
  if (views == null) {
    throw new Error("Imgur API response did not contain a numeric view_count");
  }

  return views;
}

async function run(): Promise<void> {
  if (!IS_DRY_RUN) {
    ensureDataFiles();
  }

  let successCount = 0;
  const failedSources: Source[] = [];

  if (SELECTED_SOURCES.has("realmeye")) {
    try {
      const realmeyePlayers = await scrapeRealmEye();
      appendRow(REALMEYE_FILE, realmeyePlayers);
      process.stdout.write(
        IS_DRY_RUN ? `RealmEye fetch ok (dry-run): ${realmeyePlayers}\n` : `RealmEye appended: ${realmeyePlayers}\n`
      );
      successCount += 1;
    } catch (error) {
      failedSources.push("realmeye");
      process.stderr.write(`Warning: RealmEye scrape failed: ${(error as Error).message}\n`);
    }
  }

  if (SELECTED_SOURCES.has("realmstock")) {
    try {
      const realmstockPlayers = await scrapeRealmStock();
      appendRow(REALMSTOCK_FILE, realmstockPlayers);
      process.stdout.write(
        IS_DRY_RUN
          ? `RealmStock fetch ok (dry-run): ${realmstockPlayers}\n`
          : `RealmStock appended: ${realmstockPlayers}\n`
      );
      successCount += 1;
    } catch (error) {
      failedSources.push("realmstock");
      process.stderr.write(`Warning: RealmStock scrape failed: ${(error as Error).message}\n`);
    }
  }

  if (SELECTED_SOURCES.has("launcher")) {
    try {
      const launcherViews = await scrapeImgurLauncher();
      appendRow(LAUNCHER_FILE, launcherViews);
      process.stdout.write(
        IS_DRY_RUN
          ? `Launcher views fetch ok (dry-run): ${launcherViews}\n`
          : `Launcher views appended: ${launcherViews}\n`
      );
      successCount += 1;
    } catch (error) {
      failedSources.push("launcher");
      process.stderr.write(`Warning: Launcher views scrape failed: ${(error as Error).message}\n`);
    }
  }

  if (successCount === 0) {
    process.stderr.write("Warning: all sources failed during this run.\n");
  }

  if (IS_STRICT && failedSources.length > 0) {
    throw new Error(`Strict mode failed for sources: ${failedSources.join(", ")}`);
  }
}

void run();
