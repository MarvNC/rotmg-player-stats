import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_DIR = resolve(ROOT, "data");
const REALMEYE_FILE = resolve(DATA_DIR, "realmeye-full.csv");
const REALMSTOCK_FILE = resolve(DATA_DIR, "realmstock-full.csv");
const LAUNCHER_FILE = resolve(DATA_DIR, "launcher-full.csv");
const IMGUR_POST_ID = "ovCN2lM";
const IMGUR_ANON_CLIENT_ID = "546c25a59c58ad7";
const IS_DRY_RUN = process.argv.includes("--dry-run");

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

async function scrapeRealmStock(): Promise<number> {
  const response = await fetch("https://realmstock.network/Public/PlayersOnline", {
    headers: {
      Accept: "application/json"
    }
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

function parseHistogramValues(html: string): number[] {
  const rankHistogramMatch = html.match(/renderPlayerRankHistogram\([^,]+,\s*(\[\[[\s\S]*?\]\])\s*\)/);
  if (rankHistogramMatch?.[1]) {
    const pairs = [...rankHistogramMatch[1].matchAll(/\[(\d+),(\d+)\]/g)];
    const values = pairs
      .map((match) => Number.parseInt(match[2] ?? "", 10))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (values.length > 0) {
      return values;
    }
  }

  const ySeries = [...html.matchAll(/"y"\s*:\s*\[([\d,\s]+)\]/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));

  if (ySeries.length === 0) {
    return [];
  }

  const parsedSeries = ySeries
    .map((series) =>
      series
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= 0)
    )
    .filter((series) => series.length > 1);

  if (parsedSeries.length === 0) {
    return [];
  }

  parsedSeries.sort(
    (a, b) => b.reduce((sum, value) => sum + value, 0) - a.reduce((sum, value) => sum + value, 0)
  );

  return parsedSeries[0] ?? [];
}

async function scrapeRealmEye(): Promise<number> {
  const response = await fetch("https://www.realmeye.com/number-of-active-players-by-rank", {
    headers: {
      "User-Agent": "rotmg-active-players-bot/1.0",
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`RealmEye request failed with ${response.status}`);
  }

  const html = await response.text();
  const buckets = parseHistogramValues(html);

  if (buckets.length === 0) {
    throw new Error("Unable to parse RealmEye histogram data");
  }

  return buckets.reduce((sum, value) => sum + value, 0);
}

async function scrapeImgurLauncher(): Promise<number> {
  const response = await fetch(`https://imgur.com/${IMGUR_POST_ID}`, {
    headers: {
      "User-Agent": "rotmg-active-players-bot/1.0",
      Accept: "text/html"
    }
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

  const apiResponse = await fetch(
    `https://api.imgur.com/post/v1/media/${IMGUR_POST_ID}?include=media,account`,
    {
      headers: {
        Authorization: `Client-ID ${IMGUR_ANON_CLIENT_ID}`,
        Accept: "application/json"
      }
    }
  );

  if (!apiResponse.ok) {
    throw new Error(`Imgur API fallback failed with ${apiResponse.status}`);
  }

  const apiBody = (await apiResponse.json()) as { view_count?: unknown };
  const views = Number.parseInt(String(apiBody.view_count ?? ""), 10);
  if (!Number.isFinite(views) || views < 0) {
    throw new Error("Imgur API response did not contain a numeric view_count");
  }

  return views;
}

async function run(): Promise<void> {
  if (!IS_DRY_RUN) {
    ensureDataFiles();
  }

  let successCount = 0;

  try {
    const realmeyePlayers = await scrapeRealmEye();
    appendRow(REALMEYE_FILE, realmeyePlayers);
    process.stdout.write(
      IS_DRY_RUN ? `RealmEye fetch ok (dry-run): ${realmeyePlayers}\n` : `RealmEye appended: ${realmeyePlayers}\n`
    );
    successCount += 1;
  } catch (error) {
    process.stderr.write(`Warning: RealmEye scrape failed: ${(error as Error).message}\n`);
  }

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
    process.stderr.write(`Warning: RealmStock scrape failed: ${(error as Error).message}\n`);
  }

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
    process.stderr.write(`Warning: Launcher views scrape failed: ${(error as Error).message}\n`);
  }

  if (successCount === 0) {
    process.stderr.write("Warning: all sources failed during this run.\n");
  }
}

run();
