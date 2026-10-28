# Autopilot playbook — the file the automations execute

> **This file IS the automation logic.** Each Cursor Automation is a thin shell:
> pull → run dispatcher → do exactly one action below → stop.
>
> - **Maker** — produces changes; **never merges.**
> - **Checker** — verifies, merges, optional prod guard, reports; **never writes feature code.**

## Every run

```bash
git fetch --all -q && git checkout main -q && git pull --rebase -q
node scripts/autopilot/decide-next-action.mjs --lane <maker|checker>
```

Execute only the returned JSON `action`. If `IDLE`, stop — see §0.

Prefer dependency-free verify commands documented in `docs/AGENT_ENV.md`.

---

## §0 Stop conditions — read before anything else

Automations are meant to stay **switched on permanently**. That only works if
"there is nothing to do" is a cheap, silent, zero-trace outcome. Doing nothing
well is a first-class result, not a failure.

**`IDLE` means: stop immediately and leave no trace.** Specifically, do **not**:

- open a PR, branch, issue, or commit — including to `docs/`
- "helpfully" invent work, scan the codebase for problems, or propose tasks
- write a status comment, log file, or note anywhere
- explain at length why you are idle — one line of output is enough

An idle tick should cost roughly one command. If you find yourself reasoning
about what *could* be done, you have already exceeded your mandate: the queue is
the mandate.

**Stop, changing nothing, in every one of these cases:**

| Condition | What it means | Do |
|---|---|---|
| `action: IDLE` | No actionable work this tick | Stop |
| `reason: no-autopilot-scaffolds` | Repo has no `docs/autopilot/` — never fueled | Stop. **Do not create scaffolds.** Fueling a repo is a founder decision |
| Dispatcher missing / throws / prints nothing | Loop is not installed here, or is broken | Stop. Do not proceed from memory, and do not repair the loop as a side quest |
| `pause-state.json` → `paused: true` | Kill-switch is on | Stop (Checker: only `WATCHDOG` recovery, and only when `by: deploy-watchdog`) |
| Output is not one of the actions below | Unknown state | Stop. Unknown ≠ improvise |

**Pausing and resuming is done in the repo, not in the Cursor UI.** Set
`docs/autopilot/pause-state.json` → `"paused": true` on `main` and both lanes
hold on the next tick; set it back to `false` to resume. This is deliberate: the
switch lives where an agent or a phone can reach it, so nobody has to be at a
desk to stop a loop. Toggling the Automation itself in the UI should be reserved
for retiring a project for good.

**`FORCE_NEEDS_HUMAN` is not a failure state to avoid — it is the loop working
correctly.** A lock older than `STALE_LOCK_HOURS` (default 4) with its task
still sitting in the state that lock represents means every run that touched it
crashed before reaching its own bounce-to-`ready` or bounce-to-`needs_human`
step — the normal retry/escalation bookkeeping never got a chance to fire. The
dispatcher catches this from `locks.json.since` alone, so it fires regardless of
*why* those runs crashed. Execute it exactly as instructed below and stop; do
not investigate the crash as part of this tick, and do not treat receiving this
action as something to route around.

---

## Completion status — record it, do not gate the merge on it

Acceptance stays pass/fail: the commands exit 0, or they do not. When Maker
or Checker **reports** a task, also record one completion status. This does
not change the task `status` transition in the action below, and it does not
change whether Checker merges.

| Status | When | Text |
|---|---|---|
| `done` | Acceptance from **this run** exited 0, and the report includes that output (or each exit code plus the tail of that output) | `completion.evidence` |
| `done_with_concerns` | Acceptance passed, and there is a specific doubt | `completion.concern`, one or two sentences |
| `needs_context` | Missing information, a credential, or a decision only a human can supply | `completion.concern` names the gap |
| `blocked` | Cannot proceed for a technical reason | `completion.concern` says what was tried |

No evidence means the status is not `done`. Do not write `done` with an empty `evidence`.

`needs_context` is the existing human gate. Set the task to `needs_human`. When the gap is a decision, add an open item in `decisions.json`. Do not open a second channel.

`blocked` does not add a dispatcher path. Keep the transition the action already uses (`ready` while retries remain, `needs_human` when they are exhausted or the failure is judgment).

On the task in `backlog.json`, write both (skip both when the action does not report a task):

1. Append one `feedback` string: `[completion] <status> — <concern>`. For `blocked`, use `[completion] blocked — tried: <what was tried>`. A bare `[completion] done` is allowed only together with evidence.
2. Set optional `completion`: `{ "status", "concern", "evidence", "by", "at" }`. `by` is `maker` or `checker`. `at` is ISO-8601. Tasks that omit the object stay valid.

The PR description (Maker, `gh pr create`) and the Checker review comment each include a `## Completion` block with the status, the concern when there is one, and — for `done` — the acceptance output from this run.

A green `verify-all` still merges when the status is `done_with_concerns`. The concern is recorded and shown. It does not hold the merge.

---

## Single active writer

One actor writes **source** at a time. Source is every path outside `docs/autopilot/`.

Before a human session or a hub session writes anything outside `docs/autopilot/`:

```bash
node scripts/autopilot/check-active-writer.mjs
```

The script only reads `locks.json` and `pause-state.json`.

| Exit | Meaning | What you may write |
|---|---|---|
| 0 | No live lease, not paused | Source |
| 1 | A live lease and/or a pause | Not source. See below |
| 2 | `cannot determine` | Not source. This is not "no lease" |

A lease is live while its entry remains and is not explicitly released (`active: false`, `released: true`, or `status` of `released`, `cleared`, or `free`). Age does not expire it. A stale lock is still a live lease until an action below removes the entry.

`pr` is `null` or a JSON integer. Never a URL, never a numeric string. Anything else is an unparseable lease: exit 2.

Exit 1 with a live lease: edit only control files — `decisions.json`, `roadmap.json`, and `backlog.json` fields this session owns. Do not edit `locks.json` to take the lease, and do not edit source.

Exit 1 with a pause and no lease: do not edit source in this working directory. The kill-switch is on. Another experiment goes in another git worktree or another branch, never a second writer in this directory.

Exit 2: stop. Do not treat the tree as free.

---

## MAKER lane actions

### `FORCE_NEEDS_HUMAN` (payload: `taskId`, `ageHours`, `reason`)

On **main**:

1. `backlog.json`: task → `status: needs_human`. Append to `feedback`: one
   entry noting the lock age and that it was auto-escalated (not a bounce from
   a completed run — no run this tick actually touched the task). Do not
   record completion `done` — acceptance did not run.
2. `locks.json`: remove the `<taskId>` entry entirely.
3. Commit + push to `main`. **Do not** attempt to diagnose or fix the
   underlying task in the same tick — that is a fresh `IMPLEMENT` after a human
   re-approves it, not a continuation of this one.

### `IMPLEMENT` (payload: `taskId`, `task`)

**Lock on `main` first — never only on the feature branch.**

1. `git checkout main && git pull --rebase`.
2. Lease on **main**:
   - `backlog.json`: task `status: in_progress`.
   - `locks.json`: `"locks": { "<taskId>": { "by": "maker", "since": "<ISO>", "branch": null, "pr": null } }`.
     `pr` stays `null` until a PR exists, then a JSON integer. Never a URL or a numeric string.
   - Commit + **push to `main`**. Only then create a feature branch.
3. `git checkout -b cursor/…` from that tip. Implement per task `description`.
   New user-facing behavior **must** use the task's `flag` (default off).
   Stage only changed files — **never `git add -A`**. Prefer not editing
   backlog/locks on the feature branch.
4. Run every `acceptance` command (+ project base verify). All must exit 0.
   Record a completion status (feedback line, `completion` object, and a
   `## Completion` block in the PR description). `done` only with this run's
   acceptance output in `evidence`.
   - Green → `gh pr create` with title including **`T-xxxx`**. Draft OK.
     Status is `done` when evidence is in the report; `done_with_concerns`
     when acceptance passed and the concern is one or two sentences.
     On **main**: `status: in_review`, set lock `pr` to that PR's integer,
     set `branch`, append `feedback`, set `completion`, push **main**.
     **Do NOT merge.**
   - Mechanical fail & retries left → completion `blocked`, and say what
     was tried. On main: clear lock, `ready`, increment `retries`, log
     error, push.
   - Judgment fail, retries exhausted, or a gap only a human can fill →
     on main: clear lock, `needs_human`, push. Use completion
     `needs_context` when the gap is information, a credential, or a
     decision (add `decisions.json` for a decision); use `blocked` when
     the stop is technical. Never replan judgment tasks yourself.

### `REPLAN`

Edit **only** `docs/autopilot/*`. No app code / flags / PR merges.

1. `node scripts/autopilot/apply-decision-defaults.mjs` — flip `unblocks` tasks to `ready` when auto-decided.
2. `node scripts/autopilot/queue-status.mjs`.
3. Decompose the next `approved` epic into small `ready` tasks
   (contract → API → thin UI), each with machine-checkable `acceptance`.
   - Reversible → ready tasks (decide-and-log).
   - Direction / contract / compliance → `decisions.json` (options + recommendation;
     `default_if_silent` null only for high-stakes).
   - Never invent direction → `proposed` epic + decision.
4. Optionally append durable patterns to `planner-preferences.md`.
5. Commit + push `docs/autopilot/*` to main (no PR).

**If no epic is `approved`, REPLAN is not offered — you will get `IDLE`.** An
empty roadmap means the founder has not chosen a direction yet; proposing one is
not your job.

### `IDLE`

Stop. See §0.

---

## CHECKER lane actions

> Exclude branches containing `learner` from auto-merge (founder-gated process PRs).

### `FORCE_NEEDS_HUMAN` (payload: `taskId`, `pr`, `ageHours`, `reason`)

On **main**:

1. `backlog.json`: task → `status: needs_human`. Append to `feedback`: one
   entry noting the lock age and that REVIEW kept failing to complete before it
   could bounce the task itself. Do not record completion `done`.
2. `locks.json`: remove the `<taskId>` entry entirely.
3. Commit + push to `main`. **Leave the pull request itself untouched** — do
   not close it, do not merge it. It stays open on GitHub for a human to
   inspect; the dispatcher will not offer it for `REVIEW` again once its task
   is `needs_human`, so later PRs in the queue get their turn instead of
   waiting behind this one.

### `CLOSE_STALE` (`pr`, `branch`, `taskId?`)

If task is `done` on main or `locks.json` points at another PR for the same
`T-xxxx`: close this PR as superseded. Do not change backlog for the winner.

### `REVIEW` (`pr`, `branch`)

You did not author this PR.

1. Superseded? → `CLOSE_STALE`.
2. Checkout PR head; `node scripts/autopilot/verify-all.mjs`. Record
   completion in a PR comment (`## Completion`), in `feedback`, and in
   `completion`. FAIL → comment, bounce task to `ready` or `needs_human`,
   never merge. The completion label is `blocked` or `needs_context`, not
   `done`.
3. Scope: diff matches task description; new UX behind flag.
4. Sensitive paths (auth/API/DB) → security review if available; block on high-confidence findings.
5. Green → `gh pr ready` then `gh pr merge --merge --delete-branch`.
   On main: task `done`, clear lock, push. Close duplicate `T-xxxx` PRs.
   Completion is `done` only with evidence from this verify run, or
   `done_with_concerns` with the concern in one or two sentences. A green
   verify still merges in either case.

### `WATCHDOG`

1. Allow deploy time after merge if the project auto-deploys.
2. `node scripts/autopilot/deploy-watchdog.mjs`.
   The script prints any recorded completion status and concern text.
   That print does not change PASS or FAIL.
   - PASS → stop.
   - FAIL → pause set (`by=deploy-watchdog`). Revert the bad merge if safe,
     note `needs_human`, re-run watchdog after recovery.

If no `prod_smoke_cmd` is configured, watchdog only records the main sha (see
`project-hooks.json`).

### `REPORT` (`kind` = daily | weekly)

- daily: `node scripts/autopilot/render-report.mjs > docs/autopilot/reports/$(date -u +%F).md`
- weekly: `node scripts/autopilot/weekly-report.mjs > docs/autopilot/reports/weekly-$(date -u +%F).md`
- The daily report has a Completion section: status, concern, and for a
  real `done` the stored acceptance evidence. A claimed `done` with no
  evidence is printed as refused, not as done.
- Commit + push reports. No feature code.

If the project has opted in to hub reporting (`orbita_hub: true` in
`project-hooks.json`), also regenerate the machine-readable report per
`.agents/instructions/portfolio-hub-reporting.md`. Copy task `completion`
objects into optional `completions[]` (`task_id`, `status`, `concern`,
`evidence` only). Omit the array when nothing was recorded. Do not emit
`status: done` there without `evidence`. `schema_version` stays `1.2`.

### `IDLE`

Stop. See §0.
