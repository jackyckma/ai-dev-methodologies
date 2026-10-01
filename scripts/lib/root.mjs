import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root. This file lives at scripts/lib/. */
export const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
