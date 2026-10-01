import { readFileSync } from "node:fs";
import path from "node:path";
import { gitBlob } from "./baselines.mjs";
import { lineDistance } from "./diff.mjs";
import { sha256 } from "./hash.mjs";
import { isActionable, isGlobDest } from "./manifest.mjs";

export function classifyProject(frameworkRoot, projectRoot, manifest, baselines) {
  const sourceCache = new Map();
  const blobCache = new Map();

  function sourceHash(source) {
    if (sourceCache.has(source)) return sourceCache.get(source);
    try {
      const hash = sha256(readFileSync(path.join(frameworkRoot, source)));
      sourceCache.set(source, hash);
      return hash;
    } catch {
      sourceCache.set(source, null);
      return null;
    }
  }

  function blob(commit, source) {
    const key = `${commit}:${source}`;
    if (blobCache.has(key)) return blobCache.get(key);
    const buf = gitBlob(frameworkRoot, key);
    blobCache.set(key, buf);
    return buf;
  }

  return manifest.entries.map((entry) =>
    classifyEntry(entry, { projectRoot, baselines, sourceHash, blob }),
  );
}

function classifyEntry(entry, ctx) {
  const row = {
    source: entry.source,
    dest: entry.dest,
    class: entry.class,
    state: "N/A",
    baseline: null,
    closest_baseline: null,
    action: "n/a",
    patch: null,
  };
  if (!isActionable(entry) || isGlobDest(entry.dest)) return row;

  let destBuf;
  try {
    destBuf = readFileSync(path.join(ctx.projectRoot, entry.dest));
  } catch {
    destBuf = null;
  }
  if (destBuf == null) {
    row.state = "MISSING";
    row.action = entry.class === "overwrite" ? "would-copy" : "not-copied";
    return row;
  }

  const destHash = sha256(destBuf);
  const srcHash = ctx.sourceHash(entry.source);
  if (srcHash == null) {
    throw new Error(`manifest source is not in this framework checkout: ${entry.source}`);
  }
  if (destHash === srcHash) {
    row.state = "IDENTICAL";
    row.action = "none";
    return row;
  }

  const matches = ctx.baselines.filter((b) => b.files && b.files[entry.source] === destHash);
  if (matches.length > 0) {
    row.state = "BEHIND";
    row.baseline = matches[matches.length - 1].id;
    row.action = "would-replace";
    return row;
  }

  row.state = "MODIFIED";
  row.action = "manual-merge";
  row.patch = path.posix.join(".framework-sync", `${entry.dest}.patch`);
  row.closest_baseline = closestBaseline(entry, destBuf, ctx);
  return row;
}

function closestBaseline(entry, destBuf, ctx) {
  const destText = destBuf.toString("utf8");
  let best = null;
  for (const baseline of ctx.baselines) {
    if (!baseline.files || !baseline.files[entry.source] || !baseline.commit) continue;
    const buf = ctx.blob(baseline.commit, entry.source);
    if (buf == null) continue;
    const distance = lineDistance(buf.toString("utf8"), destText);
    if (distance == null) continue;
    if (!best || distance <= best.distance) best = { id: baseline.id, distance };
  }
  return best ? best.id : null;
}
