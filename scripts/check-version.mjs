#!/usr/bin/env node
// Fail when VERSION disagrees with the version markers this repo publishes.
//
//   node scripts/check-version.mjs [--root <dir>]
//
// Markers (each file must contain exactly one, except CHANGELOG which uses
// its first release heading):
//   VERSION                         the whole file, trimmed
//   README.md                       Methodology bundle **X.Y.Z**.
//   METHODOLOGIES.md                | Bundle version | X.Y.Z |
//   AGENTS.md                       main is at vX.Y.Z (optional backticks around main)
//   CHANGELOG.md                    first ## [X.Y.Z] heading
//   framework-manifest.json         framework_version

import { readFileSync } from "node:fs";
import path from "node:path";
import { frameworkRoot as defaultRoot } from "./lib/root.mjs";

function read(root, rel) {
  try {
    return readFileSync(path.join(root, rel), "utf8");
  } catch (err) {
    return { missing: rel, message: err.message };
  }
}

function exactlyOne(label, text, re) {
  if (text && text.missing) return `${label}: file missing (${text.missing})`;
  const found = [...text.matchAll(re)].map((match) => match[1]);
  if (found.length !== 1) return `${label}: expected exactly one version marker, found ${found.length}`;
  return found[0];
}

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag >= 0 ? path.resolve(process.argv[rootFlag + 1] || "") : defaultRoot;
if (rootFlag >= 0 && !process.argv[rootFlag + 1]) {
  process.stderr.write("Usage: node scripts/check-version.mjs [--root <dir>]\n");
  process.exit(1);
}

const errors = [];
const versionFile = read(root, "VERSION");
if (versionFile && versionFile.missing) {
  errors.push("VERSION: file missing");
} else {
  const version = versionFile.trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`VERSION: expected semver, found ${JSON.stringify(version)}`);

  const readme = exactlyOne("README.md", read(root, "README.md"), /Methodology bundle \*\*(\d+\.\d+\.\d+)\*\*/g);
  const methodologies = exactlyOne(
    "METHODOLOGIES.md",
    read(root, "METHODOLOGIES.md"),
    /\| Bundle version \| (\d+\.\d+\.\d+) \|/g,
  );
  const agents = exactlyOne("AGENTS.md", read(root, "AGENTS.md"), /main`? is at v(\d+\.\d+\.\d+)/g);
  const changelogText = read(root, "CHANGELOG.md");
  let changelog = null;
  if (changelogText && changelogText.missing) changelog = "CHANGELOG.md: file missing";
  else {
    const match = changelogText.match(/^## \[(\d+\.\d+\.\d+)\]/m);
    changelog = match ? match[1] : "CHANGELOG.md: no ## [X.Y.Z] heading";
  }
  let manifestVersion = null;
  const manifestText = read(root, "framework-manifest.json");
  if (manifestText && manifestText.missing) manifestVersion = "framework-manifest.json: file missing";
  else {
    try {
      const parsed = JSON.parse(manifestText);
      manifestVersion =
        typeof parsed.framework_version === "string"
          ? parsed.framework_version
          : "framework-manifest.json: framework_version missing";
    } catch (err) {
      manifestVersion = `framework-manifest.json: ${err.message}`;
    }
  }

  for (const [label, found] of [
    ["README.md", readme],
    ["METHODOLOGIES.md", methodologies],
    ["AGENTS.md", agents],
    ["CHANGELOG.md", changelog],
    ["framework-manifest.json", manifestVersion],
  ]) {
    if (typeof found === "string" && found.includes(":")) errors.push(found);
    else if (found !== version) errors.push(`${label}: ${found} disagrees with VERSION ${version}`);
  }
}

if (errors.length) {
  process.stderr.write(errors.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`version markers agree on ${versionFile.trim()}\n`);
