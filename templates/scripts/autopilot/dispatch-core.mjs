// Pure decision logic for the autopilot 2-lane dispatcher (Maker / Checker).
// No IO here — callers gather state and pass it in, so this is unit-testable.
//
// The whole point: "deciding what to do this tick" is DETERMINISTIC (here),
// and the LLM only EXECUTES the returned action per the playbook. This keeps
// the loop predictable and debuggable.
//
// Invariant preserved by design: the Maker lane never merges; the Checker lane
// never writes feature code. Independence of review comes from each cron tick
// being a fresh agent run doing exactly ONE action.

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} status   ready|in_progress|in_review|blocked|done|needs_human
 * @property {string[]} [deps]
 * @property {number} [retries]
 */

/**
 * @typedef {Object} OpenPR
 * @property {number} number
 * @property {string} branch
 * @property {boolean} [isDraft]
 * @property {string} [title]
 */

/** @param {string|null|undefined} title */
export function extractAutopilotTaskId(title) {
  const m = String(title ?? "").match(/\bT-\d{4}\b/);
  return m ? m[0] : null;
}

/**
 * Normalise a PR reference to a number.
 *
 * `locks.json` lease.pr is written by the Maker, and the playbook did not
 * originally pin its format — in practice agents have written all three of
 * `609`, `"609"` and `"https://github.com/owner/repo/pull/609"`. Accept all.
 *
 * @param {unknown} value
 * @returns {number|null} the PR number, or null if it cannot be determined
 */
export function parsePrNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  const text = String(value).trim();
  if (text === "") return null;
  if (/^\d+$/.test(text)) return Number(text);
  const fromUrl = text.match(/\/pull\/(\d+)/);
  if (fromUrl) return Number(fromUrl[1]);
  const bareHash = text.match(/^#(\d+)$/);
  if (bareHash) return Number(bareHash[1]);
  return null;
}

/**
 * A PR is stale when its task is already done on main, or main's locks.json
 * leases a *different* PR for the same task id (duplicate Maker run).
 *
 * SAFETY RULE: if the lease exists but its PR reference cannot be parsed, this
 * returns FALSE — "unknown" must never be read as "superseded". Closing a
 * healthy PR is destructive and cannot be undone by the loop; sending it to
 * REVIEW instead costs one tick. A previous version did `Number(lease.pr)`,
 * which yields NaN for a URL, and `NaN !== 6` is true — so every oldest PR
 * looked superseded, CLOSE_STALE was proposed ahead of REVIEW on every tick,
 * the Checker agent correctly refused at the playbook gate, and the lane
 * deadlocked with PRs accumulating for days.
 *
 * @param {OpenPR} pr
 * @param {{ tasksById: Map<string, Task>, locks?: Record<string, { pr?: number|string|null }> }} ctx
 */
export function isPrSuperseded(pr, ctx) {
  const taskId = extractAutopilotTaskId(pr.title);
  if (!taskId) return false;
  const task = ctx.tasksById.get(taskId);
  if (task?.status === "done") return true;

  const lease = ctx.locks?.[taskId];
  if (lease == null || lease.pr == null) return false;

  const leasedPr = parsePrNumber(lease.pr);
  if (leasedPr == null) return false; // unparseable → not a superseded signal
  const thisPr = parsePrNumber(pr.number);
  if (thisPr == null) return false;

  return leasedPr !== thisPr;
}

/**
 * Decide the single Maker action for this tick.
 * @param {{
 *   paused:boolean,
 *   tasks:Task[],
 *   readyMin:number,
 *   hasUndecomposedApprovedEpic:boolean,
 *   lockedTaskIds?: string[],
 * }} state
 */
export function decideMaker(state) {
  const lane = "maker";
  if (state.paused) {
    return { lane, action: "IDLE", reason: "loop paused; Maker holds" };
  }

  const locked = new Set(state.lockedTaskIds ?? []);
  const doneIds = new Set(state.tasks.filter((t) => t.status === "done").map((t) => t.id));
  const actionableReady = state.tasks.filter(
    (t) =>
      t.status === "ready" &&
      !locked.has(t.id) &&
      (t.deps ?? []).every((d) => doneIds.has(d)),
  );

  // Fix-first: a task the Checker bounced back to ready (retries>0) beats fresh work.
  const bounced = actionableReady.find((t) => (t.retries ?? 0) > 0);
  const pick = bounced ?? actionableReady[0];
  if (pick) {
    return {
      lane,
      action: "IMPLEMENT",
      taskId: pick.id,
      task: pick,
      reason: bounced ? "fix bounced task (retries>0)" : "next ready task, deps done",
    };
  }

  if (actionableReady.length < state.readyMin && state.hasUndecomposedApprovedEpic) {
    return { lane, action: "REPLAN", reason: "ready queue below READY_MIN; approved epic has scope to decompose" };
  }

  return { lane, action: "IDLE", reason: "no actionable ready task; nothing to replan" };
}

/**
 * Decide the single Checker action for this tick.
 * @param {{
 *   paused:boolean,
 *   pauseBy?: string|null,
 *   openPRs:OpenPR[],
 *   tasks?: Task[],
 *   locks?: Record<string, { pr?: number|string|null }>,
 *   mainShaChanged:boolean,
 *   dailyReportDue:boolean,
 *   weeklyReportDue:boolean,
 * }} state
 */
export function decideChecker(state) {
  const lane = "checker";

  // Watchdog-set pause → recovery only. Founder/manual pause → full IDLE (do not
  // review/merge or clear the pause via a healthy smoke).
  if (state.paused) {
    if (state.pauseBy === "deploy-watchdog") {
      return { lane, action: "WATCHDOG", reason: "paused by watchdog — attempt prod recovery / clear pause" };
    }
    return { lane, action: "IDLE", reason: "paused (founder/manual); Checker holds" };
  }

  if (Array.isArray(state.openPRs) && state.openPRs.length > 0) {
    const tasksById = new Map((state.tasks ?? []).map((t) => [t.id, t]));
    const ctx = { tasksById, locks: state.locks ?? {} };

    // Drain duplicates/superseded PRs before spending a tick on verify-all (L-008).
    const stale = state.openPRs.find((pr) => isPrSuperseded(pr, ctx));
    if (stale) {
      const taskId = extractAutopilotTaskId(stale.title);
      return {
        lane,
        action: "CLOSE_STALE",
        pr: stale.number,
        branch: stale.branch,
        taskId,
        reason: "superseded autopilot PR (task done or lease points at another PR)",
      };
    }

    const pr = state.openPRs[0]; // oldest first (caller sorts)
    return {
      lane,
      action: "REVIEW",
      pr: pr.number,
      branch: pr.branch,
      reason: "open autopilot PR awaiting review",
    };
  }

  if (state.mainShaChanged) {
    return { lane, action: "WATCHDOG", reason: "main advanced since last prod check" };
  }

  if (state.weeklyReportDue) {
    return { lane, action: "REPORT", kind: "weekly", reason: "weekly review due" };
  }
  if (state.dailyReportDue) {
    return { lane, action: "REPORT", kind: "daily", reason: "no report yet today" };
  }

  return { lane, action: "IDLE", reason: "no open PRs, prod checked, reports current" };
}
