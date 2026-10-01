#!/usr/bin/env node
// Sync a project checkout to this framework repo.
//
//   node scripts/framework-sync.mjs --project <path> [--apply] [--relock] [--json] [--check] [--allow-dirty]
//
// Default is dry-run: nothing is written. --apply copies missing overwrite-class
// files and replaces overwrite/merge files that still match a known baseline.
// Modified files are never overwritten; a unified diff is written to
// <project>/.framework-sync/<dest>.patch for hand merge. There is no 3-way merge.
// --apply also lists .framework-sync/ in the project's .git/info/exclude.
//
// --relock rewrites only .agents/METHODOLOGY.lock from the files currently in
// the project. It is allowed on a dirty tree. It does not touch autopilot state.
//
// --check writes nothing and exits 0 only when every overwrite/merge file
// matches both .agents/METHODOLOGY.lock `files` hashes and the current template.
//
// --apply, --relock, and --check are mutually exclusive.
//
// Tests: node --test scripts/__tests__/

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inspectLocks, pauseWarning } from "./lib/autopilot-state.mjs";
import { loadBaselines } from "./lib/baselines.mjs";
import { checkProject } from "./lib/check.mjs";
import { classifyProject } from "./lib/classify.mjs";
import { unifiedDiff } from "./lib/diff.mjs";
import { sha256 } from "./lib/hash.mjs";
import { emptyLockData, lockToData, serializeLock } from "./lib/lockfile.mjs";
import { isActionable, isGlobDest, loadManifest } from "./lib/manifest.mjs";
import { frameworkRoot } from "./lib/root.mjs";

const USAGE = `Usage: node scripts/framework-sync.mjs --project <path> [--apply | --relock | --check] [--json] [--allow-dirty]

Default is dry-run (no writes). --relock rewrites only the methodology lock.
See instructions/framework-adoption.md.
Tests: node --test scripts/__tests__/
`;

function fail(message) {
  process.stderr.write(message.endsWith("\n") ? message : message + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const args = { apply: false, relock: false, json: false, check: false, allowDirty: false, project: "" };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--apply") args.apply = true;
    else if (token === "--relock") args.relock = true;
    else if (token === "--json") args.json = true;
    else if (token === "--check") args.check = true;
    else if (token === "--allow-dirty") args.allowDirty = true;
    else if (token === "--project") args.project = argv[++i] || "";
    else if (token.startsWith("--project=")) args.project = token.slice("--project=".length);
    else if (token === "--help" || token === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    } else fail(`Unknown argument: ${token}\n${USAGE}`);
  }
  if (!args.project) fail(USAGE);
  const modes = Number(args.apply) + Number(args.check) + Number(args.relock);
  if (modes > 1) fail("Pass only one of --apply, --check, and --relock.\n");
  return args;
}

function samePath(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function isFrameworkSyncPath(raw) {
  let text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) text = text.slice(1, -1);
  text = text.replace(/\\/g, "/");
  return text === ".framework-sync" || text === ".framework-sync/" || text.startsWith(".framework-sync/");
}

function isFrameworkSyncPorcelain(line) {
  if (line.length < 4) return false;
  return line.slice(3).split(" -> ").every(isFrameworkSyncPath);
}

function workingTree(project) {
  try {
    git(["rev-parse", "--is-inside-work-tree"], project);
  } catch {
    return { isRepo: false, dirty: true, porcelain: "" };
  }
  const porcelain = git(["status", "--porcelain"], project);
  const relevant = porcelain
    .split("\n")
    .filter((line) => line.trim() !== "" && !isFrameworkSyncPorcelain(line));
  return { isRepo: true, dirty: relevant.length > 0, porcelain: relevant.join("\n") };
}

/** List .framework-sync/ in .git/info/exclude. Never edits .gitignore. No-op outside a git repo. */
function ensureFrameworkSyncExcluded(project) {
  let excludePath;
  try {
    const gitPath = git(["rev-parse", "--git-path", "info/exclude"], project).trim();
    excludePath = path.resolve(project, gitPath);
  } catch {
    return;
  }
  mkdirSync(path.dirname(excludePath), { recursive: true });
  let text = "";
  try {
    text = readFileSync(excludePath, "utf8");
  } catch {
    text = "";
  }
  const present = text.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed === ".framework-sync/" || trimmed === ".framework-sync" || trimmed === ".framework-sync/**";
  });
  if (present) return;
  const prefix = text.length === 0 || text.endsWith("\n") ? "" : "\n";
  writeFileSync(excludePath, `${text}${prefix}.framework-sync/\n`);
}

function frameworkCommit() {
  try {
    const head = git(["rev-parse", "HEAD"], frameworkRoot).trim();
    const dirty = git(["status", "--porcelain"], frameworkRoot).trim() !== "";
    return { head, dirty };
  } catch {
    return { head: "unknown", dirty: false };
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function projectFile(project, dest) {
  const full = path.resolve(project, dest);
  const root = path.resolve(project);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`refusing to write outside the project: ${dest}`);
  }
  return full;
}

function writeFileMode(file, buf, mode) {
  mkdirSync(path.dirname(file), { recursive: true });
  let changed = false;
  let current = null;
  try {
    current = readFileSync(file);
  } catch {
    current = null;
  }
  if (!current || !current.equals(buf)) {
    writeFileSync(file, buf);
    changed = true;
  }
  if (mode != null && (statSync(file).mode & 0o777) !== mode) {
    chmodSync(file, mode);
    changed = true;
  }
  return changed;
}

function renderTable(rows) {
  const body = rows.map((row) => {
    let state = row.state;
    if (row.state === "BEHIND" && row.baseline) state = `BEHIND(${row.baseline})`;
    if (row.state === "MODIFIED") {
      state = row.closest_baseline ? `MODIFIED closest=${row.closest_baseline}` : "MODIFIED";
    }
    return [state, row.class, row.action, row.dest];
  });
  const header = ["STATE", "CLASS", "ACTION", "DEST"];
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...body.map((line) => line[index].length)),
  );
  const fmt = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  return [fmt(header), ...body.map(fmt)].join("\n") + "\n";
}

function renderCheck(report) {
  const lines = report.results.map((row) => {
    const detail = row.detail ? `  ${row.detail}` : "";
    return `${row.result.padEnd(22)} ${row.dest}${detail}`;
  });
  lines.push(report.ok ? "check: OK" : "check: FAIL");
  return lines.join("\n") + "\n";
}

function updateLock(project, manifest, commitInfo) {
  const lockPath = path.join(project, ".agents", "METHODOLOGY.lock");
  let data;
  try {
    data = lockToData(readFileSync(lockPath, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    data = emptyLockData();
  }
  if (!data.scalars.source) data.scalars.source = "https://github.com/jackyckma/ai-dev-methodologies";
  data.scalars.version = manifest.framework_version;
  data.scalars.source_commit = commitInfo.dirty ? `${commitInfo.head} (dirty)` : commitInfo.head;
  if (!data.scalars.synced_by) data.scalars.synced_by = "framework-sync";
  data.scalars.lock_schema = "2";
  data.scalars.manifest_version = manifest.framework_version;
  if (!data.lists.customized_files) {
    data.lists.customized_files = [
      ".agents/instructions/project-guidelines.md",
      "docs/AGENT_ENV.md",
      "scripts/agent-verify.sh",
    ];
  }
  if (!data.scalars.notes) data.scalars.notes = "Updated by framework-sync.";
  const files = {};
  for (const entry of manifest.entries) {
    if (!isActionable(entry) || isGlobDest(entry.dest)) continue;
    const full = projectFile(project, entry.dest);
    try {
      files[entry.dest] = sha256(readFileSync(full));
    } catch {
      // Missing merge-class files are not invented; omit them.
    }
  }
  data.maps.files = files;

  let previous = null;
  try {
    previous = readFileSync(lockPath, "utf8");
  } catch {
    previous = null;
  }
  if (!data.scalars.synced_at) data.scalars.synced_at = today();
  let text = serializeLock(data);
  if (previous === text) return false;
  data.scalars.synced_at = today();
  text = serializeLock(data);
  if (previous === text) return false;
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, text);
  return true;
}

function applyChanges(project, rows) {
  let writes = 0;
  let wrotePatch = false;
  for (const row of rows) {
    const replace = row.state === "BEHIND" && (row.class === "overwrite" || row.class === "merge");
    const copy = row.state === "MISSING" && row.class === "overwrite";
    if (replace || copy) {
      const src = path.join(frameworkRoot, row.source);
      const buf = readFileSync(src);
      const mode = statSync(src).mode & 0o777;
      const changed = writeFileMode(projectFile(project, row.dest), buf, mode);
      if (changed) writes++;
      row.action = copy ? "copied" : "replaced";
      continue;
    }
    if (row.state === "MODIFIED" && (row.class === "overwrite" || row.class === "merge")) {
      const oldText = readFileSync(projectFile(project, row.dest), "utf8");
      const newText = readFileSync(path.join(frameworkRoot, row.source), "utf8");
      const diff = unifiedDiff(oldText, newText, row.dest);
      const patchPath = projectFile(project, row.patch);
      const changed = writeFileMode(patchPath, Buffer.from(diff.text, "utf8"), null);
      if (changed) writes++;
      wrotePatch = true;
      row.action = "manual-merge";
    }
  }
  return { writes, wrotePatch };
}

function main() {
  const args = parseArgs(process.argv);
  const project = path.resolve(args.project);
  if (samePath(project, frameworkRoot)) {
    fail(`Refusing to run: --project is the framework repo itself (${frameworkRoot}). Point --project at a project checkout.`);
  }
  try {
    const st = statSync(project);
    if (!st.isDirectory()) fail(`Refusing to run: --project is not a directory: ${project}`);
  } catch {
    fail(`Refusing to run: --project does not exist: ${project}`);
  }

  const manifest = loadManifest(frameworkRoot);
  const commitInfo = frameworkCommit();

  if (args.relock) {
    const warnings = [];
    const locks = inspectLocks(project);
    if (!locks.ok) {
      warnings.push(`WARNING: ${locks.error}. --relock does not touch autopilot state.`);
    } else if (locks.active) {
      warnings.push(
        "WARNING: docs/autopilot/locks.json has an active lease. --relock does not touch autopilot state.",
      );
    }
    for (const warning of warnings) process.stderr.write(warning + "\n");
    const lockWritten = updateLock(project, manifest, commitInfo);
    const text = lockWritten
      ? "relock: wrote .agents/METHODOLOGY.lock\n"
      : "relock: .agents/METHODOLOGY.lock unchanged\n";
    const payload = {
      ok: true,
      mode: "relock",
      framework_version: manifest.framework_version,
      framework_commit: commitInfo.dirty ? `${commitInfo.head} (dirty)` : commitInfo.head,
      project,
      warnings,
      lock_written: lockWritten,
    };
    if (args.json) {
      process.stderr.write(text);
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    } else process.stdout.write(text);
    return;
  }

  if (args.check) {
    const report = checkProject(frameworkRoot, project, manifest);
    const payload = {
      ok: report.ok,
      mode: "check",
      framework_version: manifest.framework_version,
      framework_commit: commitInfo.head,
      project,
      results: report.results,
    };
    const text = renderCheck(report);
    if (args.json) {
      process.stderr.write(text);
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    } else process.stdout.write(text);
    process.exit(report.ok ? 0 : 1);
  }

  const baselines = loadBaselines(frameworkRoot);
  const warnings = [];
  if (baselines.length === 0) {
    warnings.push("WARNING: no baselines/*.json found; BEHIND cannot be detected and every difference is MODIFIED.");
  }
  const pause = pauseWarning(project);
  if (pause) warnings.push(pause);
  for (const warning of warnings) process.stderr.write(warning + "\n");

  if (args.apply) {
    const tree = workingTree(project);
    if (!args.allowDirty) {
      if (!tree.isRepo) {
        fail(`Refusing to apply: ${project} is not a git repository, so the working tree cannot be confirmed clean. Pass --allow-dirty to override.`);
      }
      if (tree.dirty) {
        fail(
          `Refusing to apply: project git working tree is not clean. Commit or stash first, or pass --allow-dirty.\n${tree.porcelain}`,
        );
      }
    }
    const locks = inspectLocks(project);
    if (!locks.ok) fail(`Refusing to apply: ${locks.error}`);
    if (locks.active) {
      fail("Refusing to apply: docs/autopilot/locks.json has an active lease. Wait until the lease is cleared. This tool will not edit locks.json.");
    }
  }

  const rows = classifyProject(frameworkRoot, project, manifest, baselines);
  let fileWrites = 0;
  let lockWritten = false;
  if (args.apply) {
    const applied = applyChanges(project, rows);
    fileWrites = applied.writes;
    if (applied.wrotePatch) ensureFrameworkSyncExcluded(project);
    lockWritten = updateLock(project, manifest, commitInfo);
  }

  const manual = rows.filter((row) => row.action === "manual-merge");
  const payload = {
    ok: true,
    mode: args.apply ? "apply" : "dry-run",
    framework_version: manifest.framework_version,
    framework_commit: commitInfo.dirty ? `${commitInfo.head} (dirty)` : commitInfo.head,
    project,
    warnings,
    file_writes: args.apply ? fileWrites : 0,
    lock_written: lockWritten,
    manual_merge: manual.map((row) => ({ dest: row.dest, patch: row.patch })),
    entries: rows,
  };
  const text = renderTable(rows) + (manual.length
    ? `\nmanual merge required:\n${manual.map((row) => `  ${row.dest} -> ${row.patch}`).join("\n")}\n`
    : "\nmanual merge required: (none)\n");
  if (args.json) {
    process.stderr.write(text);
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  } else process.stdout.write(text);
}

try {
  main();
} catch (err) {
  fail(err && err.stack ? err.stack : String(err));
}
