#!/usr/bin/env node
// Weekly roadmap/drift review for Autopilot Checker REPORT.
// Usage: node scripts/autopilot/weekly-report.mjs > docs/autopilot/reports/weekly-YYYY-MM-DD.md

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { completionLines } from "./completion-status.mjs";

function repoRoot() {
  const flag = process.argv.indexOf("--root");
  if (flag < 0) return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const value = process.argv[flag + 1];
  if (!value) {
    process.stderr.write("Usage: node scripts/autopilot/weekly-report.mjs [--root <dir>]\n");
    process.exit(1);
  }
  return path.resolve(value);
}

const root = repoRoot();
const today = new Date().toISOString().slice(0, 10);

const roadmap = JSON.parse(await readFile(path.join(root, "docs", "autopilot", "roadmap.json"), "utf8"));
const backlog = JSON.parse(await readFile(path.join(root, "docs", "autopilot", "backlog.json"), "utf8"));
const tasks = backlog.tasks ?? [];
const byId = new Map(tasks.map((t) => [t.id, t]));

const epics = roadmap.epics ?? [];
const lines = epics.map((e) => {
  const refs = (e.decomposes_into ?? []).map((id) => byId.get(id)).filter(Boolean);
  const done = refs.filter((t) => t.status === "done").length;
  return `- **${e.id}** (${e.status}) — ${e.title} — tasks ${done}/${refs.length || "?"}`;
});

const out = `# Autopilot weekly — ${today}

## Epics vs delivery
${lines.join("\n") || "- (no epics)"}

## Completion
${completionLines(tasks).map((line) => `- ${line}`).join("\n") || "- (none)"}

## Direction check
- Are \`approved\` epics still the right focus?
- Any \`proposed\` epics ready to promote?
- Open \`needs_human\` / decisions that stalled the loop?

## Guardrails reminder
- Maker never merges; Checker never writes feature code.
- Do not flip prod feature flags from automations.
`;

process.stdout.write(out);
