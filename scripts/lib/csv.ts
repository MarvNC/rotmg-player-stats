/** Parse canonical UTC CSV rows without silently accepting malformed or conflicting history. */
export function parseCsv(csv: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(\d{2}:\d{2}:\d{2}),(\d{4}-\d{2}-\d{2}),(\d+)$/.exec(line);
    if (!match) throw new Error(`Invalid CSV row: ${line}`);
    const [, time, date, value] = match;
    const key = `${date}T${time}Z`;
    const timestamp = Date.parse(key);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== `${date}T${time}.000Z`) {
      throw new Error(`Invalid UTC timestamp: ${key}`);
    }
    if (!Number.isSafeInteger(Number(value))) throw new Error(`Invalid CSV value: ${line}`);
    const previous = rows.get(key);
    if (previous != null && previous !== line) throw new Error(`Conflicting CSV rows at ${key}`);
    rows.set(key, line);
  }
  return rows;
}

export function mergeCsv(inputs: string[]): string {
  const rows = new Map<string, string>();
  for (const input of inputs) {
    for (const [key, line] of parseCsv(input)) {
      const previous = rows.get(key);
      if (previous != null && previous !== line) throw new Error(`Conflicting CSV rows at ${key}`);
      rows.set(key, line);
    }
  }
  return (
    [...rows]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, line]) => line)
      .join("\n") + "\n"
  );
}

export function assertContainsCsv(history: string, candidate: string): void {
  const rows = parseCsv(candidate);
  for (const [key, line] of parseCsv(history)) {
    if (rows.get(key) !== line) throw new Error(`Published history missing or changed at ${key}`);
  }
}
