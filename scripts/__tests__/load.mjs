// Entry point so `node --test scripts/__tests__/` runs every *.test.mjs.
// This Node build executes a directory argument via package.json "main"
// instead of walking the directory itself.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((name) => name.endsWith(".test.mjs")).sort();
for (const name of files) {
  await import(pathToFileURL(path.join(dir, name)).href);
}
