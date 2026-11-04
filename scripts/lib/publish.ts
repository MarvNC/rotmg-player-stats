import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SPECS } from "./baseline";
import { assertContainsCsv } from "./csv";
import { retry, type Run } from "./commands";

export function publishSnapshot(root: string, run: Run, sleep?: (ms: number) => void): void {
  const publishedDir = resolve(root, ".tmp/published-data");
  const baselineHead = readFileSync(resolve(root, ".tmp/published-head"), "utf8").trim();
  const git = (...args: string[]) => run(["git", ...args], publishedDir).trim();
  const remoteHead = () =>
    retry(() => git("ls-remote", "--exit-code", "origin", "refs/heads/data"), sleep).split(/\s+/)[0];
  if (git("rev-parse", "HEAD") !== baselineHead || remoteHead() !== baselineHead) {
    throw new Error("Published data changed during the scrape; refusing to overwrite it. Retry from the new baseline.");
  }
  mkdirSync(resolve(publishedDir, "csv"), { recursive: true });
  for (const { fileName } of SPECS) {
    const source = resolve(root, "data", fileName);
    const target = resolve(publishedDir, "csv", fileName);
    assertContainsCsv(readFileSync(target, "utf8"), readFileSync(source, "utf8"));
    copyFileSync(source, target);
  }
  copyFileSync(resolve(root, "src/data/daily.json"), resolve(publishedDir, "daily.json"));
  git("add", "daily.json", "csv");
  if (!git("diff", "--cached", "--name-only")) return;
  git(
    "-c",
    "user.name=github-actions[bot]",
    "-c",
    "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit",
    "-m",
    "chore(data): publish daily snapshot"
  );
  const commit = git("rev-parse", "HEAD");
  retry(() => {
    // A failed response can still mean the push was accepted. Check before retrying it.
    const head = remoteHead();
    if (head === commit) return;
    if (head !== baselineHead) throw new Error("Data branch advanced; refusing to overwrite another publisher.");
    try {
      git("push", "origin", "HEAD:refs/heads/data");
    } catch (error) {
      // Also reconcile the final failed response, when no retry remains.
      if (remoteHead() !== commit) throw error;
    }
  }, sleep);
  if (remoteHead() !== commit) throw new Error("Could not verify the published data commit.");
  process.stdout.write(`Published canonical data snapshot ${commit}\n`);
}
