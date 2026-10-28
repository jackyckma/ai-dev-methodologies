// Pure readers for the optional task.completion report field.
// No IO. Report scripts import this; they do not decide merges from it.
//
// `done` is refused when evidence is missing or blank. Callers surface that
// refusal. They must not print the status as done.

export const COMPLETION_STATUSES = Object.freeze([
  "done",
  "done_with_concerns",
  "needs_context",
  "blocked",
]);

/**
 * @param {unknown} task
 * @returns {null | { status: string, kind: "ok" | "refused" | "invalid", concern: string, evidence: string }}
 *   null when the task has no completion object (older tasks).
 */
export function readCompletion(task) {
  if (!task || typeof task !== "object" || task.completion == null) return null;
  const raw = task.completion;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { status: "", kind: "invalid", concern: "", evidence: "" };
  }
  const status = raw.status;
  const concern = typeof raw.concern === "string" ? raw.concern.trim() : "";
  const evidence = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
  if (typeof status !== "string" || !COMPLETION_STATUSES.includes(status)) {
    return { status: typeof status === "string" ? status : "", kind: "invalid", concern, evidence };
  }
  if (status === "done" && evidence === "") {
    return { status, kind: "refused", concern, evidence };
  }
  return { status, kind: "ok", concern, evidence };
}

function taskId(task) {
  return typeof task?.id === "string" && task.id.trim() !== "" ? task.id.trim() : "(task)";
}

/** One summary line: status plus concern text. Null when the task recorded nothing. */
export function formatCompletionSummary(task) {
  const read = readCompletion(task);
  if (!read) return null;
  const id = taskId(task);
  if (read.kind === "refused") {
    return `${id}: completion=done refused (no acceptance evidence from this run)`;
  }
  if (read.kind === "invalid") {
    return `${id}: completion cannot determine`;
  }
  if (read.status === "done_with_concerns" && read.concern === "") {
    return `${id}: completion=done_with_concerns — concern: (missing)`;
  }
  if (read.status === "needs_context" && read.concern === "") {
    return `${id}: completion=needs_context — concern: (missing)`;
  }
  if (read.status === "blocked" && read.concern === "") {
    return `${id}: completion=blocked — concern: (missing — say what was tried)`;
  }
  if (read.concern) return `${id}: completion=${read.status} — concern: ${read.concern}`;
  return `${id}: completion=${read.status}`;
}

export function completionLines(tasks) {
  const lines = [];
  for (const task of tasks ?? []) {
    const line = formatCompletionSummary(task);
    if (line) lines.push(line);
  }
  return lines;
}

function fence(evidence) {
  return evidence.split("```").join("'''");
}

/** Daily-report markdown. Includes stored evidence for a real `done`. */
export function formatCompletionMarkdown(tasks) {
  const blocks = [];
  for (const task of tasks ?? []) {
    const read = readCompletion(task);
    if (!read) continue;
    const id = taskId(task);
    if (read.kind === "refused") {
      blocks.push(`- ${id} — claimed done refused (no acceptance evidence from this run)`);
      continue;
    }
    if (read.kind === "invalid") {
      blocks.push(`- ${id} — completion cannot determine`);
      continue;
    }
    let line = `- ${id} — ${read.status}`;
    if (read.status === "done_with_concerns" && read.concern === "") line += " — concern: (missing)";
    else if (read.status === "needs_context" && read.concern === "") line += " — concern: (missing)";
    else if (read.status === "blocked" && read.concern === "") line += " — concern: (missing — say what was tried)";
    else if (read.concern) line += ` — concern: ${read.concern}`;
    if (read.evidence && read.kind === "ok" && (read.status === "done" || read.status === "done_with_concerns")) {
      line += `\n\n\`\`\`\n${fence(read.evidence)}\n\`\`\``;
    }
    blocks.push(line);
  }
  return blocks.join("\n");
}
