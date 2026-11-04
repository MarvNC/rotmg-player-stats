import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publishSnapshot } from "./lib/publish";
import { run } from "./lib/commands";

publishSnapshot(resolve(fileURLToPath(new URL("..", import.meta.url))), run);
