import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareBaseline } from "./lib/baseline";
import { run } from "./lib/commands";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository) throw new Error("GITHUB_REPOSITORY is required.");
prepareBaseline(resolve(fileURLToPath(new URL("..", import.meta.url))), repository, run);
