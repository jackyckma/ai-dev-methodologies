import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function readText(file) {
  const text = readFileSync(file, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isLease(value) {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim() !== "" && value.trim() !== "null";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    if (value.active === false || value.released === true) return false;
    if (value.status === "released" || value.status === "cleared" || value.status === "free") return false;
    return Object.keys(value).some((key) => !key.startsWith("_"));
  }
  return false;
}

/**
 * @returns {{ ok: true, active: boolean } | { ok: false, error: string }}
 * Absent file → no lease. Empty / whitespace → no lease.
 */
export function inspectLocks(projectRoot) {
  const file = path.join(projectRoot, "docs", "autopilot", "locks.json");
  if (!existsSync(file)) return { ok: true, active: false };
  const raw = readText(file);
  if (raw.trim() === "") return { ok: true, active: false };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "docs/autopilot/locks.json is not valid JSON, so an active lease cannot be ruled out",
    };
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "docs/autopilot/locks.json has an unexpected shape" };
  }
  if (!Object.prototype.hasOwnProperty.call(data, "locks") || data.locks == null) {
    return { ok: true, active: false };
  }
  const locks = data.locks;
  if (Array.isArray(locks)) return { ok: true, active: locks.some(isLease) };
  if (typeof locks !== "object") {
    return { ok: false, error: 'docs/autopilot/locks.json field "locks" is not an object or array' };
  }
  for (const [key, value] of Object.entries(locks)) {
    if (key.startsWith("_")) continue;
    if (isLease(value)) return { ok: true, active: true };
  }
  return { ok: true, active: false };
}

/** Null when the loop is paused. Otherwise a warning string. Never a refusal. */
export function pauseWarning(projectRoot) {
  const file = path.join(projectRoot, "docs", "autopilot", "pause-state.json");
  const tail = "This tool will not create or edit pause-state.json.";
  if (!existsSync(file)) {
    return `WARNING: docs/autopilot/pause-state.json is absent, so the autopilot is not paused. Consider pausing the repo before syncing. ${tail}`;
  }
  let data;
  try {
    data = JSON.parse(readText(file));
  } catch {
    return `WARNING: docs/autopilot/pause-state.json could not be parsed, so this tool cannot confirm the autopilot is paused. Consider pausing before syncing. ${tail}`;
  }
  if (data && data.paused === true) return null;
  return `WARNING: docs/autopilot/pause-state.json is not paused. Consider pausing the repo before syncing so a Maker/Checker tick does not race the update. ${tail}`;
}
