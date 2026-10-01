#!/usr/bin/env node
// Write baselines/<id>.json = sha256 of every framework-manifest.json source
// path as that path existed at <git-ref>. Paths missing at that ref are omitted.
//
// Usage:
//   node scripts/gen-baseline.mjs <git-ref> <id>
//
// After a release is merged to main (do not tag from a feature branch):
//   node scripts/gen-baseline.mjs HEAD 1.9.0
//
// Hashes are of the git blob at the resolved commit, not of a dirty worktree.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gitBlob } from "./lib/baselines.mjs";
import { sha256 } from "./lib/hash.mjs";
import { loadManifest } from "./lib/manifest.mjs";
import { frameworkRoot } from "./lib/root.mjs";

const ref = process.argv[2];
const id = process.argv[3];
if (!ref || !id || id.includes("/") || id.includes("..") || id.startsWith(".")) {
  process.stderr.write("Usage: node scripts/gen-baseline.mjs <git-ref> <id>\n");
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, { cwd: frameworkRoot, encoding: "utf8" }).trim();
}

let commit;
try {
  commit = git(["rev-parse", `${ref}^{commit}`]);
} catch {
  process.stderr.write(`git ref not found: ${ref}\n`);
  process.exit(1);
}
const commitTime = git(["log", "-1", "--format=%cI", commit]);
const dirty = git(["status", "--porcelain"]) !== "";
if (dirty) {
  process.stderr.write(
    `Note: working tree is dirty. Baseline ${id} hashes commit ${commit} only.\n`,
  );
}

const manifest = loadManifest(frameworkRoot);
const sources = [...new Set(manifest.entries.map((entry) => entry.source).filter(Boolean))].sort();
const files = {};
let skipped = 0;
for (const source of sources) {
  const blob = gitBlob(frameworkRoot, `${commit}:${source}`);
  if (blob == null) {
    skipped++;
    continue;
  }
  files[source] = sha256(blob);
}

const doc = {
  id,
  git_ref: ref,
  commit,
  commit_time: commitTime,
  files,
};
const dest = path.join(frameworkRoot, "baselines", `${id}.json`);
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(doc, null, 2) + "\n");
process.stdout.write(
  `wrote ${path.relative(frameworkRoot, dest)} (${Object.keys(files).length} files, ${skipped} missing at ${commit.slice(0, 12)})\n`,
);
