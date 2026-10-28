// Read-only writer check, plus completion-status surfacing.
// Run: node --test scripts/__tests__/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { frameworkRoot } from "../lib/root.mjs";
import {
  classifyLeaseEntry,
  formatWriterReport,
  inspectWriter,
  writerExitCode,
} from "../../templates/scripts/autopilot/check-active-writer.mjs";
import {
  completionLines,
  formatCompletionMarkdown,
  readCompletion,
} from "../../templates/scripts/autopilot/completion-status.mjs";

const ROOT = frameworkRoot;
const HELPER = path.join(ROOT, "templates", "scripts", "autopilot", "check-active-writer.mjs");

function tempProject() {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-check-"));
  mkdirSync(path.join(dir, "docs", "autopilot"), { recursive: true });
  return dir;
}

function writeJson(dir, rel, value) {
  writeFileSync(path.join(dir, rel), typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n");
}

function run(dir) {
  return spawnSync(process.execPath, [HELPER, "--root", dir], { encoding: "utf8" });
}

function snapshot(dir) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const next = path.join(rel, name.name);
      if (name.isDirectory()) walk(next);
      else out.push(`${next}\n${readFileSync(path.join(dir, next), "utf8")}`);
    }
  };
  walk(".");
  return out.sort().join("\n---\n");
}

test("no autopilot files is clear (exit 0) and writes nothing", () => {
  const dir = tempProject();
  const before = snapshot(dir);
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^lease: none\npause: false\nactive_writer: clear\n$/);
  assert.equal(snapshot(dir), before);
});

test("empty locks and an unpaused file are clear, and the helper does not write", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", { _doc: "lease", locks: {} });
  writeJson(dir, "docs/autopilot/pause-state.json", { paused: false, reason: null, since: null, by: null });
  const before = snapshot(dir);
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /lease: none/);
  assert.match(result.stdout, /pause: false/);
  assert.equal(snapshot(dir), before);
});

test("a lease with pr null or an integer is live (exit 1)", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", {
    locks: {
      "T-0002": { by: "maker", since: "2026-10-28T00:00:00Z", branch: "cursor/t", pr: 12 },
      "T-0001": { by: "maker", since: "2026-10-28T00:00:00Z", branch: null, pr: null },
    },
  });
  writeJson(dir, "docs/autopilot/pause-state.json", { paused: false });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /lease: live T-0001 pr=null; T-0002 pr=12/);
  assert.match(result.stdout, /active_writer: busy/);
  assert.doesNotMatch(result.stdout, /lease: none/);
});

test("pause with no lease exits 1 and still reports lease none", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", { locks: {} });
  writeJson(dir, "docs/autopilot/pause-state.json", { paused: true, reason: "hold", by: "founder" });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /lease: none\npause: true\nactive_writer: busy/);
});

test("a URL pr is cannot determine, not no lease", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", {
    locks: { "T-0001": { by: "maker", since: "2026-10-28T00:00:00Z", pr: "https://github.com/acme/app/pull/609" } },
  });
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /lease: cannot determine/);
  assert.match(result.stdout, /active_writer: cannot determine/);
  assert.match(result.stdout, /pr is not an integer or null/);
  assert.doesNotMatch(result.stdout, /lease: none/);
  assert.doesNotMatch(result.stdout, /active_writer: clear/);
});

test("a numeric string pr is cannot determine", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", { locks: { "T-0004": { pr: "12" } } });
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /cannot determine/);
  assert.doesNotMatch(result.stdout, /lease: none/);
  assert.doesNotMatch(result.stdout, /lease: live/);
});

test("invalid locks JSON is cannot determine and does not rewrite the file", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", "{");
  const before = readFileSync(path.join(dir, "docs", "autopilot", "locks.json"), "utf8");
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /locks\.json is not valid JSON/);
  assert.doesNotMatch(result.stdout, /lease: none/);
  assert.equal(readFileSync(path.join(dir, "docs", "autopilot", "locks.json"), "utf8"), before);
});

test("a non-integer pr beside a live lease stays cannot determine", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", {
    locks: {
      "T-0001": { pr: 3 },
      "T-0009": { pr: 1.5 },
    },
  });
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /unparseable lease: T-0009/);
  assert.match(result.stdout, /live lease also present: T-0001 pr=3/);
  assert.doesNotMatch(result.stdout, /lease: none/);
});

test("an explicitly released lease with an integer pr is not live", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", {
    locks: { "T-0001": { pr: 8, active: false, status: "released" } },
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /lease: none/);
});

test("a released flag does not hide an unparseable pr", () => {
  const entry = classifyLeaseEntry({ pr: "https://github.com/acme/app/pull/1", active: false });
  assert.equal(entry.kind, "unparseable");
});

test("unparseable pause is cannot determine even when no lease is held", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/locks.json", { locks: {} });
  writeJson(dir, "docs/autopilot/pause-state.json", "{");
  const inspection = inspectWriter(dir);
  assert.equal(writerExitCode(inspection), 2);
  const text = formatWriterReport(inspection);
  assert.match(text, /lease: none/);
  assert.match(text, /pause: cannot determine/);
  assert.match(text, /active_writer: cannot determine/);
});

test("missing --root value exits 2 and does not claim clear", () => {
  const result = spawnSync(process.execPath, [HELPER, "--root"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Usage:/);
});

test("done without evidence is refused; concern text is surfaced", () => {
  const tasks = [
    { id: "T-0001", completion: { status: "done", evidence: "" } },
    { id: "T-0002", completion: { status: "done", evidence: "exit 0\nok" } },
    {
      id: "T-0003",
      completion: { status: "done_with_concerns", concern: "The fixture covers only the happy path." },
    },
    { id: "T-0004", status: "ready" },
  ];
  assert.equal(readCompletion(tasks[0]).kind, "refused");
  assert.equal(readCompletion(tasks[1]).kind, "ok");
  assert.equal(readCompletion(tasks[3]), null);
  const lines = completionLines(tasks);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /T-0001: completion=done refused/);
  assert.equal(lines[1], "T-0002: completion=done");
  assert.match(lines[2], /concern: The fixture covers only the happy path/);
  const markdown = formatCompletionMarkdown(tasks);
  assert.match(markdown, /claimed done refused/);
  assert.match(markdown, /exit 0\nok/);
  assert.doesNotMatch(markdown, /T-0001 — done/);
});

test("report scripts print completion status and do not treat a bare done as done", () => {
  const dir = tempProject();
  writeJson(dir, "docs/autopilot/backlog.json", {
    tasks: [
      {
        id: "T-0008",
        title: "Widget",
        status: "done",
        feedback: ["[completion] done_with_concerns — The tail shows a retry."],
        completion: {
          status: "done_with_concerns",
          concern: "The tail shows a retry.",
          evidence: "exit 0\n1 retry",
        },
      },
      {
        id: "T-0009",
        title: "Bare",
        status: "done",
        completion: { status: "done" },
      },
    ],
  });
  writeJson(dir, "docs/autopilot/decisions.json", { decisions: [] });
  writeJson(dir, "docs/autopilot/roadmap.json", { epics: [] });

  const scripts = path.join(ROOT, "templates", "scripts", "autopilot");
  const daily = spawnSync(process.execPath, [path.join(scripts, "render-report.mjs"), "--root", dir], {
    encoding: "utf8",
  });
  assert.equal(daily.status, 0, daily.stderr);
  assert.match(daily.stdout, /## Completion/);
  assert.match(daily.stdout, /T-0008 — done_with_concerns — concern: The tail shows a retry/);
  assert.match(daily.stdout, /T-0009 — claimed done refused/);

  const queue = spawnSync(process.execPath, [path.join(scripts, "queue-status.mjs"), "--root", dir], {
    encoding: "utf8",
  });
  assert.equal(queue.status, 0, queue.stderr);
  assert.match(queue.stdout, /completions:/);
  assert.match(queue.stdout, /T-0008: completion=done_with_concerns — concern: The tail shows a retry/);
  assert.match(queue.stdout, /T-0009: completion=done refused/);

  const weekly = spawnSync(process.execPath, [path.join(scripts, "weekly-report.mjs"), "--root", dir], {
    encoding: "utf8",
  });
  assert.equal(weekly.status, 0, weekly.stderr);
  assert.match(weekly.stdout, /## Completion/);
  assert.match(weekly.stdout, /T-0008: completion=done_with_concerns — concern: The tail shows a retry/);

  const watchdog = spawnSync(process.execPath, [path.join(scripts, "deploy-watchdog.mjs"), "--root", dir], {
    encoding: "utf8",
  });
  assert.equal(watchdog.status, 0, watchdog.stderr);
  assert.match(watchdog.stdout, /completions:/);
  assert.match(watchdog.stdout, /T-0008: completion=done_with_concerns — concern: The tail shows a retry/);
  assert.match(watchdog.stdout, /^PASS /m);
});

test("hub report schema keeps schema_version 1.2 and completions optional", () => {
  const schema = JSON.parse(
    readFileSync(path.join(ROOT, "templates", "docs", "autopilot", "report.schema.json"), "utf8"),
  );
  assert.deepEqual(schema.properties.schema_version.enum, ["1.0", "1.1", "1.2"]);
  assert.equal(schema.required.includes("completions"), false);
  assert.deepEqual(schema.properties.completions.items.properties.status.enum, [
    "done",
    "done_with_concerns",
    "needs_context",
    "blocked",
  ]);
  const example = JSON.parse(
    readFileSync(path.join(ROOT, "templates", "docs", "autopilot", "report.example.json"), "utf8"),
  );
  assert.equal(example.schema_version, "1.0");
  assert.equal(example.completions[0].status, "done");
  assert.ok(example.completions[0].evidence.length > 0);
});
