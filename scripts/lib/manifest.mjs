import { readFileSync } from "node:fs";
import path from "node:path";

const CLASSES = new Set(["overwrite", "merge", "project", "ignore", "templated"]);

export function isActionable(entry) {
  return entry.class === "overwrite" || entry.class === "merge";
}

export function isGlobDest(dest) {
  return dest.includes("*");
}

export function loadManifest(root) {
  const file = path.join(root, "framework-manifest.json");
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Cannot read ${file}: ${err.message}`);
  }
  if (typeof data.schema_version !== "number") {
    throw new Error("framework-manifest.json schema_version must be a number");
  }
  if (typeof data.framework_version !== "string" || data.framework_version === "") {
    throw new Error("framework-manifest.json framework_version is missing");
  }
  if (!Array.isArray(data.entries)) throw new Error("framework-manifest.json entries must be an array");
  for (const entry of data.entries) {
    if (!entry || typeof entry.dest !== "string" || entry.dest === "") {
      throw new Error("manifest entry is missing dest");
    }
    if (!CLASSES.has(entry.class)) throw new Error(`invalid class "${entry.class}" for ${entry.dest}`);
    if (entry.source == null) entry.source = "";
    if (typeof entry.source !== "string") throw new Error(`source must be a string for ${entry.dest}`);
    if ((entry.class === "overwrite" || entry.class === "merge" || entry.class === "templated") && entry.source === "") {
      throw new Error(`${entry.class} entry ${entry.dest} requires a source path`);
    }
    if (entry.dest.split("/").includes("..") || path.isAbsolute(entry.dest)) {
      throw new Error(`dest must stay inside the project: ${entry.dest}`);
    }
  }
  return data;
}
