import { readFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "./hash.mjs";
import { isActionable, isGlobDest } from "./manifest.mjs";
import { lockToData } from "./lockfile.mjs";

export function checkProject(frameworkRoot, projectRoot, manifest) {
  const lockPath = path.join(projectRoot, ".agents", "METHODOLOGY.lock");
  let data = null;
  let lockAbsent = false;
  try {
    data = lockToData(readFileSync(lockPath, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    lockAbsent = true;
  }
  const files = data && data.maps.files ? data.maps.files : null;
  const customized = new Set(data && data.lists.customized_files ? data.lists.customized_files : []);
  const results = [];
  for (const entry of manifest.entries) {
    if (!isActionable(entry) || isGlobDest(entry.dest)) continue;
    let destBuf = null;
    try {
      destBuf = readFileSync(path.join(projectRoot, entry.dest));
    } catch {
      destBuf = null;
    }
    if (destBuf == null) {
      results.push({
        dest: entry.dest,
        class: entry.class,
        result: "missing",
        detail: "file is absent in the project",
      });
      continue;
    }
    const fileHash = sha256(destBuf);
    const lockHash = files && Object.prototype.hasOwnProperty.call(files, entry.dest) ? files[entry.dest] : null;
    if (customized.has(entry.dest)) {
      if (lockHash == null || fileHash !== lockHash) {
        results.push({
          dest: entry.dest,
          class: entry.class,
          result: "modified-since-sync",
          detail: lockHash == null
            ? "listed in customized_files; lock has no files hash for this path"
            : "listed in customized_files; file hash does not match the lock (edited after the last sync)",
        });
      } else {
        results.push({
          dest: entry.dest,
          class: entry.class,
          result: "customized",
          detail: "listed in customized_files; matches lock; template not compared",
        });
      }
      continue;
    }
    let srcBuf = null;
    try {
      srcBuf = readFileSync(path.join(frameworkRoot, entry.source));
    } catch {
      srcBuf = null;
    }
    const templateHash = srcBuf ? sha256(srcBuf) : null;
    if (lockAbsent || lockHash == null) {
      const why = lockAbsent ? "METHODOLOGY.lock is absent" : "lock has no files hash for this path";
      const matches = templateHash !== null && fileHash === templateHash;
      results.push({
        dest: entry.dest,
        class: entry.class,
        result: "behind",
        detail: matches
          ? `${why}; file matches the template but --check requires the recorded hash`
          : `${why}; file does not match the current template`,
      });
      continue;
    }
    if (fileHash !== lockHash) {
      results.push({
        dest: entry.dest,
        class: entry.class,
        result: "modified-since-sync",
        detail: "file hash does not match the lock (edited after the last sync)",
      });
      continue;
    }
    if (templateHash === null || fileHash !== templateHash) {
      results.push({
        dest: entry.dest,
        class: entry.class,
        result: "behind",
        detail: "file matches the lock but not the current template",
      });
      continue;
    }
    results.push({ dest: entry.dest, class: entry.class, result: "ok", detail: "" });
  }
  return { ok: results.every((row) => row.result === "ok" || row.result === "customized"), results };
}
