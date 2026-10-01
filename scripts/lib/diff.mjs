// Line-oriented unified diff. Zero dependencies. Used to rank the closest
// baseline and to write .framework-sync patches a reviewer can `git apply`.

const MAX_CELLS = 2_000_000;
const CONTEXT = 3;

export function splitLines(text) {
  if (text === "") return { lines: [], nl: true };
  const nl = text.endsWith("\n");
  const lines = text.split("\n");
  if (nl) lines.pop();
  return { lines, nl };
}

/** Insertions + deletions, or null when the file is too large to diff here. */
export function lineDistance(oldText, newText) {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = editOps(a.lines, b.lines);
  if (!ops) return null;
  let d = 0;
  for (const op of ops) if (op.t !== "eq") d++;
  if (a.nl !== b.nl) d++;
  return d;
}

export function unifiedDiff(oldText, newText, filePath) {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = editOps(a.lines, b.lines);
  let text = `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n`;
  if (!ops) {
    text += "Files differ (too large for the built-in line diff)\n";
    return { text, distance: null };
  }
  text += formatHunks(ops, a.nl, b.nl);
  let distance = 0;
  for (const op of ops) if (op.t !== "eq") distance++;
  if (a.nl !== b.nl) distance++;
  return { text, distance };
}

function editOps(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_CELLS) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i];
    const next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) row[j] = next[j + 1] + 1;
      else row[j] = next[j] >= dp[i][j + 1] ? next[j] : dp[i][j + 1];
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: "eq", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: "del", line: a[i] });
      i++;
    } else {
      ops.push({ t: "ins", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ t: "del", line: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ t: "ins", line: b[j] });
    j++;
  }
  return ops;
}

function formatHunks(ops, oldNl, newNl) {
  const changed = [];
  for (let i = 0; i < ops.length; i++) if (ops[i].t !== "eq") changed.push(i);
  if (changed.length === 0) return "";

  const groups = [];
  let gs = changed[0];
  let ge = changed[0];
  for (let k = 1; k < changed.length; k++) {
    if (changed[k] - ge <= CONTEXT * 2) ge = changed[k];
    else {
      groups.push([gs, ge]);
      gs = ge = changed[k];
    }
  }
  groups.push([gs, ge]);

  const meta = [];
  let oldLine = 1;
  let newLine = 1;
  for (const op of ops) {
    meta.push({
      t: op.t,
      line: op.line,
      oldLine: op.t === "ins" ? 0 : oldLine,
      newLine: op.t === "del" ? 0 : newLine,
    });
    if (op.t !== "ins") oldLine++;
    if (op.t !== "del") newLine++;
  }
  const oldTotal = oldLine - 1;
  const newTotal = newLine - 1;

  let out = "";
  for (const [cs, ce] of groups) {
    const from = Math.max(0, cs - CONTEXT);
    const to = Math.min(ops.length - 1, ce + CONTEXT);
    const slice = meta.slice(from, to + 1);
    const oldCount = slice.filter((x) => x.t !== "ins").length;
    const newCount = slice.filter((x) => x.t !== "del").length;
    const oldStart = oldCount === 0 ? 0 : slice.find((x) => x.t !== "ins").oldLine;
    const newStart = newCount === 0 ? 0 : slice.find((x) => x.t !== "del").newLine;
    out += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;
    for (const x of slice) {
      const prefix = x.t === "eq" ? " " : x.t === "del" ? "-" : "+";
      out += `${prefix}${x.line}\n`;
      if (!oldNl && x.t !== "ins" && x.oldLine === oldTotal) out += "\\ No newline at end of file\n";
      if (!newNl && x.t !== "del" && x.newLine === newTotal) out += "\\ No newline at end of file\n";
    }
  }
  return out;
}
