import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGrowth } from "./lib/growth";

const outcomes = {
  realmeye: process.env.REALMEYE_OUTCOME,
  realmstock: process.env.REALMSTOCK_OUTCOME,
  launcher: process.env.LAUNCHER_OUTCOME,
};
// Local callers retain the original strict behavior unless outcomes are explicitly supplied.
verifyGrowth(
  resolve(fileURLToPath(new URL("..", import.meta.url))),
  Object.values(outcomes).some((value) => value !== undefined) ? outcomes : undefined
);
