import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SourceRow = {
  localDateTime: string;
  views: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_FILE = resolve(ROOT, "RotMG Launcher Loads - Data.csv");
const OUTPUT_FILE = resolve(ROOT, "data", "launcher-full.csv");
const SOURCE_TIMEZONE = "America/New_York";
const LAUNCHER_MIN_DATE = "2024-07-03";

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function offsetMillisAt(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = formatter.formatToParts(instant);
  const values = new Map<string, number>();

  for (const part of parts) {
    if (part.type === "literal") {
      continue;
    }

    values.set(part.type, Number.parseInt(part.value, 10));
  }

  const utcFromZone = Date.UTC(
    values.get("year") ?? 1970,
    (values.get("month") ?? 1) - 1,
    values.get("day") ?? 1,
    values.get("hour") ?? 0,
    values.get("minute") ?? 0,
    values.get("second") ?? 0
  );

  return utcFromZone - instant.getTime();
}

function nyLocalToUtc(localDateTime: string): { date: string; time: string } | null {
  const match = localDateTime.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const month = Number.parseInt(match[1] ?? "", 10);
  const day = Number.parseInt(match[2] ?? "", 10);
  const year = Number.parseInt(match[3] ?? "", 10);
  const hour = Number.parseInt(match[4] ?? "", 10);
  const minute = Number.parseInt(match[5] ?? "", 10);
  const second = Number.parseInt(match[6] ?? "0", 10);

  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  const localAsUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMillis = localAsUtcMillis;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offset = offsetMillisAt(new Date(utcMillis), SOURCE_TIMEZONE);
    utcMillis = localAsUtcMillis - offset;
  }

  const converted = new Date(utcMillis);

  return {
    date: converted.toISOString().slice(0, 10),
    time: converted.toISOString().slice(11, 19)
  };
}

function parseRows(csv: string): SourceRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trimEnd());
  const rows: SourceRow[] = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const columns = splitCsvLine(line);
    const rawTime = columns[0]?.trim() ?? "";
    const rawViews = columns[1]?.trim() ?? "";

    if (!rawTime || rawTime.toLowerCase() === "time") {
      continue;
    }

    const views = Number.parseInt(rawViews.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(views) || views < 0) {
      continue;
    }

    rows.push({ localDateTime: rawTime, views });
  }

  return rows;
}

function run(): void {
  if (!existsSync(SOURCE_FILE)) {
    throw new Error(`Missing source CSV: ${SOURCE_FILE}`);
  }

  const source = readFileSync(SOURCE_FILE, "utf8");
  const rows = parseRows(source);

  const seen = new Set<string>();
  const normalized = rows
    .map((row) => {
      const utc = nyLocalToUtc(row.localDateTime);
      if (!utc) {
        return null;
      }

      if (utc.date < LAUNCHER_MIN_DATE) {
        return null;
      }

      return {
        key: `${utc.date}T${utc.time}`,
        line: `${utc.time},${utc.date},${row.views}`
      };
    })
    .filter((entry): entry is { key: string; line: string } => entry !== null)
    .filter((entry) => {
      if (seen.has(entry.key)) {
        return false;
      }

      seen.add(entry.key);
      return true;
    })
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => entry.line);

  mkdirSync(resolve(ROOT, "data"), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${normalized.join("\n")}\n`, "utf8");

  process.stdout.write(`Migrated ${rows.length} launcher rows to ${normalized.length} UTC rows.\n`);
}

run();
