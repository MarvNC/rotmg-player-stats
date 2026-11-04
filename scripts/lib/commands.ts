import { spawnSync } from "node:child_process";

export type Run = (command: string[], cwd?: string) => string;

export const run: Run = (command, cwd) => {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${command[0]}\n${result.stderr || result.stdout}`);
  return result.stdout;
};

/** Only wrap idempotent operations. Git pushes additionally check their uncertain outcome. */
export function retry<T>(
  operation: () => T,
  sleep: (ms: number) => unknown = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
): T {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      if (attempt >= 2) throw error;
      process.stderr.write(`Transient operation failed; retrying (${attempt + 1}/2).\n`);
      sleep(2000 * 2 ** attempt);
    }
  }
}
