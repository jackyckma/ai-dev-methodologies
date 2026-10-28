#!/usr/bin/env node
// Read-only check for a human or hub session before it writes source.
// Reads docs/autopilot/locks.json and docs/autopilot/pause-state.json.
// Does not write, take, or clear a lease, and does not start or stop the loop.
//
// Exit 0 — no live lease, not paused.
// Exit 1 — a live lease and/or a pause exists.
// Exit 2 — cannot determine (unparseable lease or pause). Never "no lease".
//
// Usage: node scripts/autopilot/check-active-writer.mjs [--root <dir>]
//
// A lease `pr` is null or a JSON integer. A URL or a numeric string is
// unparseable. Age does not expire a lease; a stale lock is still live
// until the playbook removes it.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RELEASED_STATUS = new Set(["released", "cleared", "free"]);

function readText(file) {
  const text = readFileSync(file, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function prKind(value) {
  if (!Object.prototype.hasOwnProperty.call(value, "pr") || value.pr === null) return "ok";
  if (typeof value.pr === "number" && Number.isInteger(value.pr)) return "ok";
  return "bad";
}

function prLabel(value) {
  if (!Object.prototype.hasOwnProperty.call(value, "pr") || value.pr === null) return "null";
  return String(value.pr);
}

/**
 * @returns {{ kind: "none" | "live" | "unparseable", detail?: string }}
 */
export function classifyLeaseEntry(value) {
  if (value == null || value === false) return { kind: "none" };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { kind: "unparseable", detail: "lease is not an object" };
  }
  if (prKind(value) === "bad") {
    return { kind: "unparseable", detail: "pr is not an integer or null" };
  }
  if (value.active === false || value.released === true) return { kind: "none" };
  if (typeof value.status === "string" && RELEASED_STATUS.has(value.status)) return { kind: "none" };
  const keys = Object.keys(value).filter((key) => !key.startsWith("_"));
  if (keys.length === 0) return { kind: "none" };
  return { kind: "live" };
}

/**
 * @returns {{ state: "none" | "live" | "unparseable", live: string[], reason: string }}
 */
export function inspectLocks(root) {
  const file = path.join(root, "docs", "autopilot", "locks.json");
  if (!existsSync(file)) return { state: "none", live: [], reason: "" };
  const raw = readText(file);
  if (raw.trim() === "") return { state: "none", live: [], reason: "" };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: "unparseable", live: [], reason: "locks.json is not valid JSON" };
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { state: "unparseable", live: [], reason: "locks.json has an unexpected shape" };
  }
  if (!Object.prototype.hasOwnProperty.call(data, "locks") || data.locks == null) {
    return { state: "none", live: [], reason: "" };
  }
  if (typeof data.locks !== "object" || Array.isArray(data.locks)) {
    return { state: "unparseable", live: [], reason: 'locks.json field "locks" is not an object' };
  }

  const live = [];
  const bad = [];
  for (const [key, value] of Object.entries(data.locks)) {
    if (key.startsWith("_")) continue;
    const classified = classifyLeaseEntry(value);
    if (classified.kind === "live") live.push(`${key} pr=${prLabel(value)}`);
    else if (classified.kind === "unparseable") bad.push(`${key} (${classified.detail})`);
  }
  live.sort();
  bad.sort();
  if (bad.length > 0) {
    const also = live.length > 0 ? `; live lease also present: ${live.join("; ")}` : "";
    return {
      state: "unparseable",
      live,
      reason: `unparseable lease: ${bad.join("; ")}${also}`,
    };
  }
  if (live.length > 0) return { state: "live", live, reason: "" };
  return { state: "none", live: [], reason: "" };
}

/**
 * @returns {{ state: "clear" | "paused" | "unparseable", reason: string }}
 */
export function inspectPause(root) {
  const file = path.join(root, "docs", "autopilot", "pause-state.json");
  if (!existsSync(file)) return { state: "clear", reason: "" };
  const raw = readText(file);
  if (raw.trim() === "") return { state: "unparseable", reason: "pause-state.json is empty" };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: "unparseable", reason: "pause-state.json is not valid JSON" };
  }
  if (data == null || typeof data !== "object" || Array.isArray(data) || typeof data.paused !== "boolean") {
    return { state: "unparseable", reason: "pause-state.json paused is not a boolean" };
  }
  if (data.paused === true) return { state: "paused", reason: "" };
  return { state: "clear", reason: "" };
}

export function inspectWriter(root) {
  return { lease: inspectLocks(root), pause: inspectPause(root) };
}

export function writerExitCode(inspection) {
  if (inspection.lease.state === "unparseable" || inspection.pause.state === "unparseable") return 2;
  if (inspection.lease.state === "live" || inspection.pause.state === "paused") return 1;
  return 0;
}

export function formatWriterReport(inspection) {
  const lease = inspection.lease;
  const pause = inspection.pause;
  const leaseLine =
    lease.state === "none"
      ? "none"
      : lease.state === "live"
        ? `live ${lease.live.join("; ")}`
        : `cannot determine (${lease.reason})`;
  const pauseLine =
    pause.state === "paused" ? "true" : pause.state === "clear" ? "false" : `cannot determine (${pause.reason})`;
  const code = writerExitCode(inspection);
  const active = code === 2 ? "cannot determine" : code === 1 ? "busy" : "clear";
  return `lease: ${leaseLine}\npause: ${pauseLine}\nactive_writer: ${active}\n`;
}

function repoRootFromArgs(argv) {
  const flag = argv.indexOf("--root");
  if (flag < 0) return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const value = argv[flag + 1];
  if (!value || value.startsWith("--")) return null;
  return path.resolve(value);
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

export function runCheck(argv) {
  const root = repoRootFromArgs(argv);
  if (!root) {
    process.stderr.write("Usage: node scripts/autopilot/check-active-writer.mjs [--root <dir>]\n");
    return 2;
  }
  const inspection = inspectWriter(root);
  process.stdout.write(formatWriterReport(inspection));
  return writerExitCode(inspection);
}

if (invokedAsCli()) {
  process.exit(runCheck(process.argv.slice(2)));
}
