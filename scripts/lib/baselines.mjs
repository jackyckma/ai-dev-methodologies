import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function gitBlob(repo, spec) {
  try {
    return execFileSync("git", ["cat-file", "blob", spec], {
      cwd: repo,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

export function loadBaselines(root) {
  const dir = path.join(root, "baselines");
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  const all = names.map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")));
  all.sort((a, b) => {
    if (a.commit_time < b.commit_time) return -1;
    if (a.commit_time > b.commit_time) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return all;
}
