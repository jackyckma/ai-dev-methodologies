// Framework sync, baselines, version check, and bootstrap safety.
// Run: node --test scripts/__tests__/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sha256 } from "../lib/hash.mjs";
import { lockToData, serializeLock } from "../lib/lockfile.mjs";
import { isActionable, isGlobDest, loadManifest } from "../lib/manifest.mjs";
import { frameworkRoot } from "../lib/root.mjs";

const ROOT = frameworkRoot;
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "framework-sync-test",
  GIT_AUTHOR_EMAIL: "framework-sync-test@example.com",
  GIT_COMMITTER_NAME: "framework-sync-test",
  GIT_COMMITTER_EMAIL: "framework-sync-test@example.com",
};

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "fw-sync-"));
  return dir;
}

function node(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: process.env });
}

function git(args, cwd, encoding) {
  const r = spawnSync("git", args, { cwd, encoding: encoding === undefined ? "utf8" : encoding, env: gitEnv });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function commitAll(dir, message) {
  git(["add", "-A"], dir);
  git(["commit", "-m", message], dir);
}

function initRepo(dir) {
  git(["init", "-b", "main"], dir);
  commitAll(dir, "init");
}

function write(dir, rel, data) {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, data);
}

function blob(spec) {
  const r = spawnSync("git", ["cat-file", "blob", spec], { cwd: ROOT });
  if (r.status !== 0) throw new Error(`missing blob ${spec}`);
  return r.stdout;
}

const V1_LOCK = `# Methodology bundle pin — update only after a manual sync (see framework-adoption.md).

source: https://github.com/jackyckma/ai-dev-methodologies
version: "1.3.0"
source_commit: af32f3a
synced_at: 2026-08-01
synced_by: bootstrap
customized_files:
  - .agents/instructions/project-guidelines.md
  - docs/AGENT_ENV.md
  - scripts/agent-verify.sh
notes: Initial bootstrap. Customize project-owned files before serious agent work.
owner: jane
`;

test("manifest dests are listed in framework-adoption.md and bootstrap sources are covered", () => {
  const manifest = loadManifest(ROOT);
  const adoption = readFileSync(path.join(ROOT, "instructions/framework-adoption.md"), "utf8");
  for (const entry of manifest.entries) {
    const escaped = entry.dest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(adoption, new RegExp(`^${escaped}$`, "m"), entry.dest);
  }

  const sources = new Set(manifest.entries.map((entry) => entry.source).filter(Boolean));
  const expect = [];
  for (const name of readdirSync(path.join(ROOT, "instructions"))) {
    if (name.endsWith(".md")) expect.push(`instructions/${name}`);
  }
  expect.push("METHODOLOGIES.md");
  for (const name of readdirSync(path.join(ROOT, "defaults"))) {
    if (name.endsWith(".md")) expect.push(`defaults/${name}`);
  }
  expect.push(
    "compatibility/local-vs-cloud-agents.md",
    "compatibility/agent-capability-matrix.template.md",
    "templates/.agents/README.md",
    "templates/.agents/skills/README.md",
    "templates/.agents/METHODOLOGY.lock",
    "templates/AGENTS.md",
    "templates/CLAUDE.md",
    "templates/.cursor/rules/shared-instructions.mdc",
    "templates/project-guidelines.template.md",
    "templates/docs/README.md",
    "templates/docs/CURRENT_STATUS.md",
    "templates/docs/SESSION_HANDOFF.md",
    "templates/scripts/agent-verify.sh",
    "scripts/setup-cloud-agent-env.sh",
    "templates/docs/autopilot/reports/README.md",
  );
  for (const name of readdirSync(path.join(ROOT, "templates/docs/autopilot"))) {
    const full = path.join(ROOT, "templates/docs/autopilot", name);
    if (statSync(full).isFile()) expect.push(`templates/docs/autopilot/${name}`);
  }
  for (const name of readdirSync(path.join(ROOT, "templates/scripts/autopilot"))) {
    if (name.endsWith(".mjs")) expect.push(`templates/scripts/autopilot/${name}`);
  }
  function walk(dir, prefix) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = `${prefix}/${name}`;
      if (statSync(full).isDirectory()) walk(full, rel);
      else expect.push(rel);
    }
  }
  walk(path.join(ROOT, "templates/.agents/skills"), "templates/.agents/skills");
  for (const rel of expect) assert.ok(sources.has(rel), `manifest missing bootstrap source ${rel}`);
});

test("historical baselines hash the git blobs and skip paths that did not exist", () => {
  const b12 = JSON.parse(readFileSync(path.join(ROOT, "baselines/1.2.0.json"), "utf8"));
  const b13 = JSON.parse(readFileSync(path.join(ROOT, "baselines/1.3.0.json"), "utf8"));
  const b16 = JSON.parse(readFileSync(path.join(ROOT, "baselines/1.6.0-aaa5724.json"), "utf8"));
  const b18 = JSON.parse(readFileSync(path.join(ROOT, "baselines/1.8.0.json"), "utf8"));
  assert.equal(b12.files["templates/docs/autopilot/playbook.md"], undefined);
  assert.equal(typeof b13.files["templates/docs/autopilot/playbook.md"], "string");
  assert.ok(b13.commit.startsWith("af32f3a"));
  assert.ok(b16.commit.startsWith("aaa5724"));
  assert.ok(b18.commit.startsWith("d2f10c9"));
  const sample = "instructions/karpathy-guidelines.md";
  assert.equal(b12.files[sample], sha256(blob(`${b12.commit}:${sample}`)));
  assert.equal(b18.files[sample], sha256(blob(`${b18.commit}:${sample}`)));
});

test("check-version passes on this repo and fails on a mismatched marker", () => {
  const ok = node(["scripts/check-version.mjs"]);
  assert.equal(ok.status, 0, ok.stderr);

  const dir = tempDir();
  try {
    write(dir, "VERSION", "1.9.0\n");
    write(dir, "README.md", "Methodology bundle **1.8.0**.\n");
    write(dir, "METHODOLOGIES.md", "| Bundle version | 1.9.0 |\n");
    write(dir, "AGENTS.md", "- `main` is at v1.9.0.\n");
    write(dir, "CHANGELOG.md", "## [1.9.0] - 2026-10-01\n");
    write(dir, "framework-manifest.json", JSON.stringify({ framework_version: "1.9.0" }));
    const bad = node(["scripts/check-version.mjs", "--root", dir]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /README\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses to run when --project is the framework repo", () => {
  const dry = node(["scripts/framework-sync.mjs", "--project", ROOT]);
  assert.notEqual(dry.status, 0);
  assert.match(dry.stderr, /framework repo itself/);
  const check = node(["scripts/framework-sync.mjs", "--project", ROOT, "--check"]);
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /framework repo itself/);
});

test("classification, apply, patches, v1 lock, and a second apply", () => {
  const dir = tempDir();
  try {
    const manifest = loadManifest(ROOT);
    const karpathyRel = ".agents/instructions/karpathy-guidelines.md";
    const methRel = ".agents/instructions/METHODOLOGIES.md";
    const playRel = "docs/autopilot/playbook.md";
    const coreRel = "scripts/autopilot/dispatch-core.mjs";
    const decideRel = "scripts/autopilot/decide-next-action.mjs";

    write(dir, karpathyRel, readFileSync(path.join(ROOT, "instructions/karpathy-guidelines.md")));
    const oldMeth = blob("d2f10c9:METHODOLOGIES.md");
    write(dir, methRel, oldMeth);
    const playSrc = readFileSync(path.join(ROOT, "templates/docs/autopilot/playbook.md"));
    write(dir, playRel, Buffer.concat([playSrc, Buffer.from("PROJECT EDIT SENTINEL\n")]));

    const planted = {
      "docs/autopilot/locks.json": '{"locks":{}}\n',
      "docs/autopilot/backlog.json": '{"tasks":["sentinel"]}\n',
      "docs/autopilot/roadmap.json": '{"sentinel":true}\n',
      "docs/autopilot/decisions.json": '{"decisions":[]}\n',
      "docs/autopilot/pause-state.json": '{"paused":false}\n',
      "docs/autopilot/project-hooks.json": '{"prod_smoke_cmd":"sentinel"}\n',
      "docs/autopilot/watchdog-state.json": '{"last_checked_sha":"sentinel"}\n',
      "docs/autopilot/planner-preferences.md": "sentinel preferences\n",
      "docs/autopilot/lessons.md": "sentinel lesson\n",
      "docs/autopilot/reports/latest.json": '{"report":"sentinel"}\n',
      "docs/CURRENT_STATUS.md": "sentinel status\n",
      "docs/SESSION_HANDOFF.md": "sentinel handoff\n",
      ".agents/instructions/project-guidelines.md": "sentinel guidelines\n",
      "docs/AGENT_ENV.md": "sentinel env\n",
      "scripts/agent-verify.sh": "echo sentinel\n",
    };
    for (const [rel, text] of Object.entries(planted)) write(dir, rel, text);
    write(dir, ".agents/METHODOLOGY.lock", V1_LOCK);
    const before = Object.fromEntries(
      Object.keys(planted).map((rel) => [rel, sha256(readFileSync(path.join(dir, rel)))]),
    );
    const karpathyBefore = sha256(readFileSync(path.join(dir, karpathyRel)));

    initRepo(dir);

    const dry = node(["scripts/framework-sync.mjs", "--project", dir, "--json"]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stderr, /WARNING: docs\/autopilot\/pause-state.json is not paused/);
    const dryBody = JSON.parse(dry.stdout);
    const byDest = Object.fromEntries(dryBody.entries.map((row) => [row.dest, row]));
    assert.equal(byDest[karpathyRel].state, "IDENTICAL");
    assert.equal(byDest[methRel].state, "BEHIND");
    assert.ok(byDest[methRel].baseline);
    const methHash = sha256(oldMeth);
    const matching = ["1.2.0", "1.3.0", "1.6.0-aaa5724", "1.8.0"].filter((id) => {
      const doc = JSON.parse(readFileSync(path.join(ROOT, "baselines", `${id}.json`), "utf8"));
      return doc.files["METHODOLOGIES.md"] === methHash;
    });
    assert.equal(byDest[methRel].baseline, matching[matching.length - 1]);
    assert.equal(byDest[playRel].state, "MODIFIED");
    assert.equal(typeof byDest[playRel].closest_baseline, "string");
    assert.equal(byDest[coreRel].state, "MISSING");
    assert.equal(byDest[coreRel].action, "would-copy");
    assert.equal(byDest[decideRel].state, "MISSING");
    assert.equal(byDest[decideRel].action, "not-copied");
    assert.equal(byDest["docs/autopilot/locks.json"].state, "N/A");
    assert.equal(byDest["docs/autopilot/reports/**"].state, "N/A");
    assert.equal(byDest[".agents/instructions/project-guidelines.md"].state, "N/A");

    const human = node(["scripts/framework-sync.mjs", "--project", dir]);
    assert.match(human.stdout, /IDENTICAL/);
    assert.match(human.stdout, /BEHIND\(/);
    assert.match(human.stdout, /manual merge required/);

    const applied = node(["scripts/framework-sync.mjs", "--project", dir, "--apply", "--json"]);
    assert.equal(applied.status, 0, applied.stderr);
    const appliedBody = JSON.parse(applied.stdout);
    assert.ok(appliedBody.manual_merge.some((row) => row.dest === playRel));
    assert.match(readFileSync(path.join(dir, playRel), "utf8"), /PROJECT EDIT SENTINEL/);
    const patch = path.join(dir, ".framework-sync", `${playRel}.patch`);
    assert.equal(existsSync(patch), true);
    assert.match(readFileSync(patch, "utf8"), /^-PROJECT EDIT SENTINEL/m);
    const applyCheck = spawnSync("git", ["apply", "--check", patch], { cwd: dir, encoding: "utf8" });
    assert.equal(applyCheck.status, 0, applyCheck.stderr);

    assert.equal(
      sha256(readFileSync(path.join(dir, methRel))),
      sha256(readFileSync(path.join(ROOT, "METHODOLOGIES.md"))),
    );
    assert.equal(karpathyBefore, sha256(readFileSync(path.join(dir, karpathyRel))));
    assert.equal(existsSync(path.join(dir, coreRel)), true);
    assert.equal(
      sha256(readFileSync(path.join(dir, coreRel))),
      sha256(readFileSync(path.join(ROOT, "templates/scripts/autopilot/dispatch-core.mjs"))),
    );
    assert.equal(existsSync(path.join(dir, decideRel)), false);
    assert.ok((statSync(path.join(dir, "scripts/setup-cloud-agent-env.sh")).mode & 0o111) !== 0);
    for (const [rel, hash] of Object.entries(before)) {
      assert.equal(sha256(readFileSync(path.join(dir, rel))), hash, rel);
    }

    const lock = lockToData(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock"), "utf8"));
    assert.equal(lock.scalars.version, "1.9.0");
    assert.equal(lock.scalars.lock_schema, "2");
    assert.equal(lock.scalars.manifest_version, "1.9.0");
    assert.equal(lock.scalars.synced_by, "bootstrap");
    assert.equal(lock.scalars.owner, "jane");
    assert.match(lock.scalars.notes, /^Initial bootstrap/);
    assert.deepEqual(lock.lists.customized_files, [
      ".agents/instructions/project-guidelines.md",
      "docs/AGENT_ENV.md",
      "scripts/agent-verify.sh",
    ]);
    const head = git(["rev-parse", "HEAD"], ROOT).trim();
    const dirty = git(["status", "--porcelain"], ROOT).trim() !== "";
    assert.equal(lock.scalars.source_commit, dirty ? `${head} (dirty)` : head);
    assert.equal(lock.maps.files[karpathyRel], karpathyBefore);
    assert.equal(lock.maps.files[playRel], sha256(readFileSync(path.join(dir, playRel))));
    assert.equal(lock.maps.files[decideRel], undefined);

    commitAll(dir, "sync");
    const again = node(["scripts/framework-sync.mjs", "--project", dir, "--apply", "--json"]);
    assert.equal(again.status, 0, again.stderr);
    const againBody = JSON.parse(again.stdout);
    assert.equal(againBody.file_writes, 0);
    assert.equal(againBody.lock_written, false);
    assert.equal(git(["status", "--porcelain"], dir).trim(), "");
    assert.match(readFileSync(path.join(dir, playRel), "utf8"), /PROJECT EDIT SENTINEL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--apply refuses a dirty tree unless --allow-dirty, and never edits a modified file", () => {
  const dir = tempDir();
  try {
    const rel = ".agents/instructions/karpathy-guidelines.md";
    write(dir, rel, readFileSync(path.join(ROOT, "instructions/karpathy-guidelines.md")));
    write(dir, "docs/autopilot/pause-state.json", '{"paused":true}\n');
    initRepo(dir);
    write(dir, rel, readFileSync(path.join(dir, rel), "utf8") + "DIRTY\n");
    const dirtyBytes = readFileSync(path.join(dir, rel));
    const refused = node(["scripts/framework-sync.mjs", "--project", dir, "--apply"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not clean/);
    assert.deepEqual(readFileSync(path.join(dir, rel)), dirtyBytes);
    assert.equal(existsSync(path.join(dir, ".framework-sync")), false);
    assert.equal(existsSync(path.join(dir, ".agents/METHODOLOGY.lock")), false);

    const allowed = node(["scripts/framework-sync.mjs", "--project", dir, "--apply", "--allow-dirty"]);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.match(readFileSync(path.join(dir, rel), "utf8"), /DIRTY/);
    assert.equal(existsSync(path.join(dir, ".framework-sync", `${rel}.patch`)), true);
    assert.doesNotMatch(allowed.stderr, /WARNING:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--apply refuses an active lease and invalid locks.json, and accepts an absent locks file", () => {
  const active = tempDir();
  try {
    write(active, "docs/autopilot/locks.json", '{"locks":{"T-1":{"since":"2026-10-01T00:00:00Z","pr":1}}}\n');
    write(active, "README.md", "x\n");
    const before = readFileSync(path.join(active, "docs/autopilot/locks.json"));
    initRepo(active);
    const refused = node(["scripts/framework-sync.mjs", "--project", active, "--apply"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /active lease/);
    assert.deepEqual(readFileSync(path.join(active, "docs/autopilot/locks.json")), before);
    assert.equal(existsSync(path.join(active, ".framework-sync")), false);
  } finally {
    rmSync(active, { recursive: true, force: true });
  }

  const broken = tempDir();
  try {
    write(broken, "docs/autopilot/locks.json", "{");
    write(broken, "README.md", "x\n");
    initRepo(broken);
    const refused = node(["scripts/framework-sync.mjs", "--project", broken, "--apply"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not valid JSON/);
    assert.equal(readFileSync(path.join(broken, "docs/autopilot/locks.json"), "utf8"), "{");
  } finally {
    rmSync(broken, { recursive: true, force: true });
  }

  const absent = tempDir();
  try {
    write(absent, "README.md", "x\n");
    write(absent, "docs/autopilot/pause-state.json", '{"paused":true}\n');
    initRepo(absent);
    const applied = node(["scripts/framework-sync.mjs", "--project", absent, "--apply"]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(existsSync(path.join(absent, "docs/autopilot/locks.json")), false);
    assert.equal(existsSync(path.join(absent, "scripts/autopilot/dispatch-core.mjs")), true);
  } finally {
    rmSync(absent, { recursive: true, force: true });
  }
});

test("--check exit codes: ok, behind, modified-since-sync, missing; check does not write", () => {
  const dir = tempDir();
  try {
    const manifest = loadManifest(ROOT);
    for (const entry of manifest.entries) {
      if (!isActionable(entry) || isGlobDest(entry.dest)) continue;
      write(dir, entry.dest, readFileSync(path.join(ROOT, entry.source)));
    }
    write(dir, "docs/autopilot/pause-state.json", '{"paused":true}\n');
    write(dir, ".agents/METHODOLOGY.lock", V1_LOCK);
    initRepo(dir);
    const applied = node(["scripts/framework-sync.mjs", "--project", dir, "--apply"]);
    assert.equal(applied.status, 0, applied.stderr);
    const lockBytes = readFileSync(path.join(dir, ".agents/METHODOLOGY.lock"));
    const checked = node(["scripts/framework-sync.mjs", "--project", dir, "--check", "--json"]);
    assert.equal(checked.status, 0, checked.stderr);
    assert.deepEqual(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock")), lockBytes);
    assert.equal(JSON.parse(checked.stdout).ok, true);

    const target = ".agents/instructions/karpathy-guidelines.md";
    const original = readFileSync(path.join(dir, target));
    write(dir, target, Buffer.concat([original, Buffer.from("edited-after-sync\n")]));
    const edited = node(["scripts/framework-sync.mjs", "--project", dir, "--check", "--json"]);
    assert.equal(edited.status, 1);
    const editedRow = JSON.parse(edited.stdout).results.find((row) => row.dest === target);
    assert.equal(editedRow.result, "modified-since-sync");
    assert.deepEqual(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock")), lockBytes);

    const old = blob("d2f10c9:METHODOLOGIES.md");
    const meth = ".agents/instructions/METHODOLOGIES.md";
    write(dir, target, original);
    write(dir, meth, old);
    const data = lockToData(lockBytes.toString("utf8"));
    data.maps.files[meth] = sha256(old);
    write(dir, ".agents/METHODOLOGY.lock", serializeLock(data));
    const behind = node(["scripts/framework-sync.mjs", "--project", dir, "--check", "--json"]);
    assert.equal(behind.status, 1);
    const behindRow = JSON.parse(behind.stdout).results.find((row) => row.dest === meth);
    assert.equal(behindRow.result, "behind");

    rmSync(path.join(dir, "scripts/autopilot/dispatch-core.mjs"));
    const missing = node(["scripts/framework-sync.mjs", "--project", dir, "--check", "--json"]);
    assert.equal(missing.status, 1);
    const missingRow = JSON.parse(missing.stdout).results.find((row) => row.dest === "scripts/autopilot/dispatch-core.mjs");
    assert.equal(missingRow.result, "missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("bootstrap --force keeps project-state files unless --reset-project-state", () => {
  const dir = tempDir();
  try {
    const first = spawnSync("bash", [path.join(ROOT, "scripts/bootstrap-project.sh"), dir], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /framework-sync/);
    assert.match(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock"), "utf8"), /lock_schema: 2/);

    const locks = path.join(dir, "docs/autopilot/locks.json");
    const backlog = path.join(dir, "docs/autopilot/backlog.json");
    const guidelines = path.join(dir, ".agents/instructions/project-guidelines.md");
    const karpathy = path.join(dir, ".agents/instructions/karpathy-guidelines.md");
    const lockPath = path.join(dir, ".agents/METHODOLOGY.lock");
    writeFileSync(lockPath, `${readFileSync(lockPath, "utf8")}owner: kept-by-project\n`);
    writeFileSync(locks, '{"locks":{"keep":true}}\n');
    writeFileSync(backlog, '{"tasks":["keep"]}\n');
    writeFileSync(guidelines, "sentinel guidelines\n");
    writeFileSync(karpathy, "sentinel karpathy\n");

    const forced = spawnSync("bash", [path.join(ROOT, "scripts/bootstrap-project.sh"), dir, "--force"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /skip \(project-state.*METHODOLOGY\.lock/);
    assert.match(readFileSync(lockPath, "utf8"), /owner: kept-by-project/);
    assert.equal(readFileSync(locks, "utf8"), '{"locks":{"keep":true}}\n');
    assert.equal(readFileSync(backlog, "utf8"), '{"tasks":["keep"]}\n');
    assert.equal(readFileSync(guidelines, "utf8"), "sentinel guidelines\n");
    assert.equal(
      readFileSync(karpathy, "utf8"),
      readFileSync(path.join(ROOT, "instructions/karpathy-guidelines.md"), "utf8"),
    );

    const reset = spawnSync(
      "bash",
      [path.join(ROOT, "scripts/bootstrap-project.sh"), dir, "--force", "--reset-project-state"],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(reset.status, 0, reset.stderr);
    assert.equal(
      readFileSync(locks, "utf8"),
      readFileSync(path.join(ROOT, "templates/docs/autopilot/locks.json"), "utf8"),
    );
    assert.equal(
      readFileSync(backlog, "utf8"),
      readFileSync(path.join(ROOT, "templates/docs/autopilot/backlog.json"), "utf8"),
    );
    assert.equal(
      readFileSync(guidelines, "utf8"),
      readFileSync(path.join(ROOT, "templates/project-guidelines.template.md"), "utf8"),
    );
    const resetLock = readFileSync(lockPath, "utf8");
    assert.match(resetLock, /lock_schema: 2/);
    assert.doesNotMatch(resetLock, /owner: kept-by-project/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fileHashes(dir, skip) {
  const out = {};
  function walk(rel) {
    for (const name of readdirSync(path.join(dir, rel))) {
      if (rel === "" && (name === ".git" || name === ".framework-sync")) continue;
      const next = rel ? `${rel}/${name}` : name;
      if (skip.has(next)) continue;
      const full = path.join(dir, next);
      if (statSync(full).isDirectory()) walk(next);
      else out[next] = sha256(readFileSync(full));
    }
  }
  walk("");
  return out;
}

test("--relock updates only the lock on a dirty tree and --check passes after hand-merge", () => {
  const dir = tempDir();
  try {
    const manifest = loadManifest(ROOT);
    const playRel = "docs/autopilot/playbook.md";
    const playSrc = readFileSync(path.join(ROOT, "templates/docs/autopilot/playbook.md"));
    for (const entry of manifest.entries) {
      if (!isActionable(entry) || isGlobDest(entry.dest)) continue;
      const buf = entry.dest === playRel ? Buffer.concat([playSrc, Buffer.from("PROJECT EDIT SENTINEL\n")]) : readFileSync(path.join(ROOT, entry.source));
      write(dir, entry.dest, buf);
    }
    const lockText = V1_LOCK.replace(
      "  - scripts/agent-verify.sh\n",
      "  - scripts/agent-verify.sh\n  - docs/LOCAL.md\n",
    );
    write(dir, ".agents/METHODOLOGY.lock", lockText);
    write(dir, "docs/autopilot/pause-state.json", '{"paused":true}\n');
    write(dir, ".gitignore", "node_modules\n");
    initRepo(dir);

    const applied = node(["scripts/framework-sync.mjs", "--project", dir, "--apply", "--json"]);
    assert.equal(applied.status, 0, applied.stderr);
    const excludePath = path.join(dir, ".git/info/exclude");
    assert.match(readFileSync(excludePath, "utf8"), /^\.framework-sync\/$/m);
    assert.equal(readFileSync(path.join(dir, ".gitignore"), "utf8"), "node_modules\n");

    const excludeBefore = readFileSync(excludePath, "utf8").replace(/^\.framework-sync\/\n/m, "");
    writeFileSync(excludePath, excludeBefore);
    const again = node(["scripts/framework-sync.mjs", "--project", dir, "--apply", "--allow-dirty"]);
    assert.equal(again.status, 0, again.stderr);
    const excludeLines = readFileSync(excludePath, "utf8").split("\n").filter((line) => line.trim() === ".framework-sync/");
    assert.equal(excludeLines.length, 1);
    assert.equal(readFileSync(path.join(dir, ".gitignore"), "utf8"), "node_modules\n");

    write(dir, playRel, playSrc);
    const refused = node(["scripts/framework-sync.mjs", "--project", dir, "--apply"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not clean/);

    const before = fileHashes(dir, new Set([".agents/METHODOLOGY.lock"]));
    const relock = node(["scripts/framework-sync.mjs", "--project", dir, "--relock", "--json"]);
    assert.equal(relock.status, 0, relock.stderr);
    const relockBody = JSON.parse(relock.stdout);
    assert.equal(relockBody.mode, "relock");
    assert.equal(relockBody.lock_written, true);
    assert.deepEqual(fileHashes(dir, new Set([".agents/METHODOLOGY.lock"])), before);
    const lock = lockToData(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock"), "utf8"));
    assert.equal(lock.maps.files[playRel], sha256(playSrc));
    assert.equal(lock.scalars.owner, "jane");
    assert.ok(lock.lists.customized_files.includes("docs/LOCAL.md"));

    const lockBytes = readFileSync(path.join(dir, ".agents/METHODOLOGY.lock"));
    const second = node(["scripts/framework-sync.mjs", "--project", dir, "--relock", "--json"]);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).lock_written, false);
    assert.deepEqual(readFileSync(path.join(dir, ".agents/METHODOLOGY.lock")), lockBytes);
    assert.match(second.stderr, /unchanged/);

    const checked = node(["scripts/framework-sync.mjs", "--project", dir, "--check"]);
    assert.equal(checked.status, 0, checked.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--relock refuses the framework repo and a missing path, warns on an active lease, and does not combine with --apply", () => {
  const missingParent = tempDir();
  try {
    const missing = node(["scripts/framework-sync.mjs", "--project", path.join(missingParent, "no-such-dir"), "--relock"]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /does not exist/);
  } finally {
    rmSync(missingParent, { recursive: true, force: true });
  }

  const self = node(["scripts/framework-sync.mjs", "--project", ROOT, "--relock"]);
  assert.notEqual(self.status, 0);
  assert.match(self.stderr, /framework repo itself/);

  const both = node(["scripts/framework-sync.mjs", "--project", ROOT, "--relock", "--apply"]);
  assert.notEqual(both.status, 0);
  assert.match(both.stderr, /only one of/);

  const dir = tempDir();
  try {
    const lease = '{"locks":{"T-1":{"since":"2026-10-01T00:00:00Z","pr":1}}}\n';
    write(dir, "docs/autopilot/locks.json", lease);
    write(dir, "README.md", "x\n");
    initRepo(dir);
    const relock = node(["scripts/framework-sync.mjs", "--project", dir, "--relock"]);
    assert.equal(relock.status, 0, relock.stderr);
    assert.match(relock.stderr, /WARNING:.*active lease/);
    assert.equal(readFileSync(path.join(dir, "docs/autopilot/locks.json"), "utf8"), lease);
    assert.equal(existsSync(path.join(dir, ".framework-sync")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(".framework-sync dirt is ignored, and a non-git project does not grow a .git", () => {
  const dir = tempDir();
  try {
    write(dir, "README.md", "x\n");
    initRepo(dir);
    write(dir, ".framework-sync/leftover.patch", "not a real change\n");
    write(dir, "DIRTY.txt", "real dirt\n");
    const refused = node(["scripts/framework-sync.mjs", "--project", dir, "--apply"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not clean/);
    assert.match(refused.stderr, /DIRTY\.txt/);
    assert.doesNotMatch(refused.stderr, /\.framework-sync/);

    rmSync(path.join(dir, "DIRTY.txt"));
    const applied = node(["scripts/framework-sync.mjs", "--project", dir, "--apply"]);
    assert.equal(applied.status, 0, applied.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const bare = tempDir();
  try {
    const playRel = "docs/autopilot/playbook.md";
    const playSrc = readFileSync(path.join(ROOT, "templates/docs/autopilot/playbook.md"));
    write(bare, playRel, Buffer.concat([playSrc, Buffer.from("LOCAL\n")]));
    write(bare, "docs/autopilot/pause-state.json", '{"paused":true}\n');
    const applied = node(["scripts/framework-sync.mjs", "--project", bare, "--apply", "--allow-dirty"]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(existsSync(path.join(bare, ".git")), false);
    assert.equal(existsSync(path.join(bare, ".framework-sync", `${playRel}.patch`)), true);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
