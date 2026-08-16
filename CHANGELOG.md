# Changelog

All notable changes to the methodology bundle. Projects pin their synced version in `.agents/METHODOLOGY.lock`.

Format based on [Keep a Changelog](https://keepachangelog.com/). Version follows semver on [VERSION](VERSION).

**Maintainers:** see [CHANGELOG-GUIDE.md](CHANGELOG-GUIDE.md) for release checklist and entry template.

## [1.7.0] - 2026-08-16

Autopilot stall safety net, plus a retroactive entry for the deadlock fix that
shipped 2026-08-09 without one. Reconstructed from actual commit history
(`git log`), not from memory — see the note at the end of this entry.

### Added — stall safety net (`FORCE_NEEDS_HUMAN`)

Motivation: `locks.json.since` already records when Maker leases a task, before
anything that could crash. A normal `IMPLEMENT` or `REVIEW` finishes in one
tick (minutes); if a lock sits past a threshold with its task still in the
state that lock represents, every run that touched it must have crashed before
reaching the playbook's own bounce-to-`ready` / bounce-to-`needs_human` step —
so the normal retry/escalation bookkeeping never got a chance to fire, and
without a check the same lock gets silently re-picked (Maker) or silently
ignored (Checker, head-of-line blocking the whole PR queue) forever.

- `templates/scripts/autopilot/dispatch-core.mjs` — `findStaleLock()` (pure,
  takes `nowMs` and a threshold, no IO) checks `locks.json.since` against a
  configurable `staleHours`. `decideMaker` runs it first, ahead of picking new
  work (`statusMatch: "in_progress"`). `decideChecker` runs it first too
  (`statusMatch: "in_review"`), and PRs whose task is already `needs_human` are
  filtered out of the REVIEW-picking queue so later PRs get a turn instead of
  the FIFO order re-picking the same stuck one.
- `templates/scripts/autopilot/decide-next-action.mjs` — new env var
  `STALE_LOCK_HOURS` (default 4), passes `locks` + `nowMs` through to both
  lanes.
- `templates/docs/autopilot/playbook.md` — new `FORCE_NEEDS_HUMAN` action for
  both lanes: clear the lock, set the task `needs_human`, append `feedback`,
  push. Checker's version explicitly leaves the PR itself open and untouched —
  never merge or close on a failure it can't diagnose. New §0 note: receiving
  this action is the loop working correctly, not a fault to route around.

No new persisted counters and no extra commits on the happy path — reuses a
timestamp `locks.json` already had for a different purpose, and only writes
anything once a lock has actually gone stale.

### Fixed (retroactive — actually shipped 2026-08-09, undocumented until now)

- `templates/scripts/autopilot/dispatch-core.mjs` — `isPrSuperseded` did
  `Number(lease.pr)`, which is `NaN` for a URL, and `NaN !== 6` is `true` — so
  whenever a Maker run wrote `locks.json` lease.pr as a full PR URL instead of
  a bare number, the oldest open PR always looked superseded. `decideChecker`
  checks `CLOSE_STALE` before `REVIEW`, so every tick proposed closing a
  healthy PR; the Checker agent correctly refused at the playbook gate and
  stopped, so the lane never reached `REVIEW` and PRs piled up for days while
  Makers kept producing more. New `parsePrNumber()` accepts a bare number,
  numeric string, or PR URL, and returns `null` (never a false "superseded")
  when it can't be parsed — ambiguity falls toward the safe action (review),
  never the destructive one (close). This is the incident referenced in
  orbita's `docs/autopilot/pause-state.json` `_last_incident`.

**This fix landed in the template on 2026-08-09 but at least one project
(orbita) never received it in a sync** — its `dispatch-core.mjs` still had the
vulnerable `Number(lease.pr)` line as of 2026-08-16, seven days later. The
`locks.json` *data* had been hand-corrected to integers at the time, which
masked the gap: the bug only resurfaces the next time a lease is written as a
URL. Worth an audit of which other projects are in the same state.

### Migration

- **Bundle files:** re-sync `dispatch-core.mjs`, `decide-next-action.mjs`,
  `playbook.md`.
- **Cursor UI:** none — `FORCE_NEEDS_HUMAN` is executed by the same
  Maker/Checker prompts already pasted; no new Automation or trigger needed.
- **Existing `locks.json` data:** no migration; `since` already exists on every
  lease this bundle has ever written.
- Tune `STALE_LOCK_HOURS` per project if a repo's normal `IMPLEMENT`/`REVIEW`
  genuinely takes longer than a few minutes; default 4h assumes it doesn't.

### Notify text

> Methodology updated to **v1.7.0**. Autopilot dispatcher gets a stall safety
> net: a lock stuck past `STALE_LOCK_HOURS` (default 4h) auto-escalates to
> `needs_human` instead of silently retrying forever or blocking the PR queue
> behind it — re-sync `dispatch-core.mjs`, `decide-next-action.mjs`,
> `playbook.md`. Also: the 2026-08-09 lease-URL deadlock fix is now properly
> documented here — **check whether your project's `dispatch-core.mjs` ever
> actually received it**; `locks.json` data being correct does not mean the
> code fix landed.

## [1.6.0] - 2026-08-07

Report contract → schema/contract v1.2: a third, independent report line for
deployment status.

### Added

- `instructions/portfolio-hub-reporting.md` — **deploy edge**, alongside repo
  and runtime. Motivation: a merge marks a task done, but if the build fails
  the code never reaches production, and a prod smoke can still pass against
  the *previous* successful deployment — the failed release is the easiest
  kind of failure to miss. Nobody in the product repo produces this; the hub
  collects it from the hosting platform's API. Only the runtime edge needs
  per-project work — repo is already in git, deploy is one platform
  credential — so most projects implement nothing at all to get all three
  lines.
- `templates/docs/autopilot/report.schema.json` — `edge` accepts `deploy`;
  `schema_version` accepts `1.2` alongside `1.0`/`1.1`. Additive: every 1.0/1.1
  payload is still valid.

### Migration

- **Bundle files:** re-sync `portfolio-hub-reporting.md`, `report.schema.json`.
- **Report payloads:** none required; `deploy` is a new optional edge value.

### Notify text

> Methodology updated to **v1.6.0**. Report contract → **v1.2**: adds a
> **deploy** edge (build/release status from the hosting platform) alongside
> repo and runtime — no payload migration needed, 1.0/1.1 stay valid.

---

*Editorial note on this entry and 1.7.0's retroactive section: `VERSION` was
bumped to 1.6.0 on 2026-08-07 but this file was never updated to match — the
gap was flagged in a hub session-handoff note and closed here on 2026-08-16 by
reconstructing from `git log` rather than from memory of what changed.*

## [1.5.0] - 2026-08-07

Two corrections to 1.4.0, plus making Autopilot Automations safe to leave switched on permanently.

### Changed — report contract v1.0 → v1.1 (additive, nothing breaks)

- `instructions/portfolio-hub-reporting.md` — **§1 now separates the repo edge from the runtime edge.** 1.4.0 collapsed two genuinely different reports into one and defaulted everything to the file transport. That was wrong: a production service does not know what is in `backlog.json`, and a git repo does not know last night's error rate or queue depth. Each edge now has its own transport (repo → committed file, runtime → HTTP), sharing one section set so briefs stay comparable. §4 gives per-edge fill guidance for all six sections.
- `templates/docs/autopilot/report.schema.json` — optional `edge` field (`repo` \| `runtime`), defaulting to `repo`; `schema_version` accepts `1.0` and `1.1`. **Every 1.0 payload is still valid** — this is the worked example of the additive path.
- `instructions/portfolio-hub-reporting.md` **§8 Evolving this contract** — the process that was missing in 1.4.0: change classes (clarification / additive / breaking), version rules, and the load-bearing migration rule that **the hub must accept both versions during a migration window**, because several projects will never migrate on the same day. Also states who decides (founder, at the framework repo) and that an agent finding the contract wrong must say so, not patch its local copy.
- `project-hooks.json` gains `orbita_hub_edges` to declare which edges a project publishes.

### Changed — Automations designed to stay on forever

Motivation: needing to toggle an Automation in the Cursor UI is a liability, because the moment you need it off is usually the moment you are away from a computer.

- `templates/scripts/autopilot/decide-next-action.mjs` — preflight returns `IDLE` with reason `no-autopilot-scaffolds` when `docs/autopilot/{backlog,roadmap}.json` are absent, instead of running on empty fallbacks. A repo whose Automations were wired before it had scaffolds now costs one command per tick and stops.
- `templates/docs/autopilot/playbook.md` — new **§0 Stop conditions**: `IDLE` means stop immediately and leave no trace (no PR, branch, issue, commit, note, or long explanation); explicit stop table for missing scaffolds, dispatcher failure, pause, and unknown output; "unknown ≠ improvise". Documents that **pause/resume lives in `pause-state.json` on `main`, not in the UI**. REPLAN section now states that an empty roadmap yields IDLE rather than an invitation to propose direction.
- `templates/docs/autopilot/automations.md` — pasted Maker/Checker prompts gain an explicit guard: stop if the dispatcher is missing, fails, prints nothing, or returns IDLE. New **Control surface** table mapping intents (pause everything / resume / idle one project / stop one task) to repo files, so the founder never needs the Cursor UI for routine control.

### Migration

- **Bundle files:** re-sync `portfolio-hub-reporting.md`, `report.schema.json`, `playbook.md`, `automations.md`, `scripts/autopilot/decide-next-action.mjs`.
- **Cursor UI:** one-time re-paste of the two Agent Instructions from `automations.md` per project. This is the last UI trip the design requires — afterwards, control is in the repo.
- **Report payloads:** none. `edge` is optional; existing generators keep working and are treated as `edge: repo`.

### Notify text

> Methodology updated to **v1.5.0**. Report contract → **v1.1**: repo edge and runtime edge are now separate (file transport vs HTTP) with an added optional `edge` field — **no payload migration needed**, 1.0 stays valid. Autopilot: re-sync `playbook.md`, `automations.md`, `decide-next-action.mjs`, then **re-paste the two Agent Instructions once** in the Cursor UI. After that, pause/resume via `docs/autopilot/pause-state.json` on `main` — do not toggle Automations in the UI. Unfueled repos now IDLE silently instead of improvising.

## [1.4.0] - 2026-08-07

Portfolio hub reporting (optional Tier B6). Lets several projects report into one hub in a comparable shape, so a single agent session can brief across the portfolio without crawling every repo.

### Added

- `instructions/portfolio-hub-reporting.md` — six-section report contract, payload spec, transports, opt-in gate, anti-patterns
- `templates/docs/autopilot/report.schema.json` — JSON Schema for contract `schema_version` **1.0**; validates section set, order, and the "empty section keeps its key" rule
- `templates/docs/autopilot/report.example.json` — worked fixture including an empty section and a correctly written `needs_founder` item

### Changed

- `METHODOLOGIES.md` — Tier **B6** row, adoption-matrix row, optional-practice gate now names B5 and B6; **version table corrected** (said 1.2.0 while VERSION/README said 1.3.0)
- `instructions/README.md` — B6 index row
- `instructions/framework-adoption.md` — §2 canonical list adds `portfolio-hub-reporting.md`, `report.schema.json`, `report.example.json` as framework-owned; `docs/autopilot/reports/**` explicitly project-owned; `project-hooks.json` hybrid rule now mentions the `orbita_hub` opt-in; new anti-pattern for locally editing the schema
- `README.md`, `VERSION` → **1.4.0**

### Known issue (fixed in 1.5.0)

This release treated repo state and runtime state as one report and defaulted to the file transport. See 1.5.0 §1.

## [1.3.0] - 2026-08-07

Cursor Automations Autopilot harvested from Powerhouse / HiFi Job (optional Tier B5).

### Added

- `instructions/cursor-autopilot.md` — Maker/Checker loop, install checklist, hard rules, adoption gate (vs session `autonomous-loop.md`)
- `templates/docs/autopilot/` — README, playbook, automations (paste prompts), JSON scaffolds, project-hooks, reports placeholder
- `templates/scripts/autopilot/` — `dispatch-core.mjs`, `decide-next-action.mjs`, `queue-status.mjs`, `apply-decision-defaults.mjs`, generic `verify-all.mjs` (calls `agent-verify.sh` or `AUTOPILOT_VERIFY_CMD`), `deploy-watchdog.mjs` (optional `PROD_SMOKE_CMD`), `render-report.mjs`, `weekly-report.mjs`
- Bootstrap copies Autopilot scaffolds into target projects (skip-if-exists)

### Changed

- `METHODOLOGIES.md`, `instructions/README.md`, `templates/.agents/README.md` — Tier **B5** index + trigger
- `instructions/autonomous-loop.md` — clarifies session-loop vs Cursor Autopilot
- `instructions/framework-adoption.md` — sync rules for autopilot scripts/playbook vs project-owned backlog JSON
- `templates/project-guidelines.template.md` — optional `cursor-autopilot` adoption note
- `README.md`, `VERSION` → **1.3.0**

### Notify text

> Methodology updated to **v1.3.0**. Optional **Cursor Autopilot** (Maker/Checker): sync `cursor-autopilot.md` + `docs/autopilot/{README,playbook,automations}.md` + `scripts/autopilot/*.mjs` if you want the loop; **do not** overwrite a live `backlog.json`/`roadmap.json`/`decisions.json`. New projects get scaffolds from bootstrap. Create two Cursor Automations from `automations.md` manually.

## [1.2.0] - 2026-07-10

Agent-first maturity release, authored on branch `fable5/framework-upgrade-20260710`.
Background and rationale: `docs/fable5-audit/DIAGNOSIS.md`.

### Added

- `instructions/model-orchestration.md` — model/subagent dispatch contract, escalation ladder, verification-not-by-author (Tier C6)
- `instructions/judgment-rubrics.md` — externalized judgment: done / stuck / escalate / ask rubrics, each with a positive and a negative example (Tier A8)
- `instructions/autonomous-loop.md` — unattended issue-queue protocol: preconditions, loop log, stop conditions, batch exit report (Tier B4)
- `instructions/framework-evolution.md` — maintainer process: intake, proposal format, upstream harvest, release coherence checklist (Tier A9)
- `instructions/agent-native-practices.md` — **optional** Tier E practices (structured state file, AI-first formats, machine-verifiable docs, fixture-first) with an explicit per-project adoption gate

### Changed

- `METHODOLOGIES.md`, `instructions/README.md` — index new instruction files (Tiers A8, A9, B4, C6, E); judgment-rubrics and agent-tooling-guardrails added to session-start reading order
- `instructions/karpathy-guidelines.md` — §1 "ask" now routes through decision-authority tiers (removes the always-ask vs never-drip conflict)
- `instructions/decision-authority.md` — rewritten as three tiers (decide-and-log, queue-for-batch, block-and-ask) with decision-brief format and deferral tactics
- `instructions/lane-based-development.md` — §10 now points to decision-authority.md instead of duplicating it
- `instructions/session-handoff.md`, `templates/docs/SESSION_HANDOFF.md` — added "Pending decisions" and "Loop log" sections for batched briefs and autonomous runs
- `templates/AGENTS.md`, `templates/CLAUDE.md`, `templates/.cursor/rules/shared-instructions.mdc`, `templates/.agents/README.md` — entry-point parity: identical core reading list in all three tools; single file→trigger map lives in `.agents/README.md`; Cursor rule no longer hardcodes a response language (set it in `project-guidelines.md`)
- `instructions/framework-adoption.md` — §2 marked as the **canonical** framework-owned sync list; new instruction files and `.agents/compatibility/local-vs-cloud-agents.md` added to it
- `CHANGELOG-GUIDE.md` — framework-owned path list replaced by a pointer to framework-adoption §2; release gate now includes the framework-evolution coherence checklist
- `templates/project-guidelines.template.md` — communication language is now a per-project placeholder (no hardcoded default); added "Adopted optional practices" section (Tier E gate)
- `compatibility/agent-capability-matrix.template.md` — added "Models available" table per model-orchestration §1
- `scripts/bootstrap-project.sh` — copies `compatibility/local-vs-cloud-agents.md` into `.agents/compatibility/` so verification-ladder references resolve inside projects
- `README.md` — version bump, entry-point parity note, link to framework-evolution

### Notify text

> Methodology updated to **v1.2.0**. New core file `judgment-rubrics.md` (always-read) plus `model-orchestration.md`, `autonomous-loop.md`, `agent-native-practices.md` (optional), `framework-evolution.md`; entry points (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/shared-instructions.mdc`) and `.agents/README.md` changed — replace all four, then sync the other framework-owned files per `framework-adoption.md` §3.

## [1.1.0] - 2026-06-18

### Added

- [framework-adoption.md](instructions/framework-adoption.md) — import rules and manual update process for bootstrapped projects
- [CHANGELOG-GUIDE.md](CHANGELOG-GUIDE.md) — maintainer release checklist and entry template
- `.agents/METHODOLOGY.lock` — version pin written on bootstrap
- Karpathy guidelines: solution ladder, `defer:` comments, scope boundary, auto-clarity
- Issue quality: agent-ready checklist
- Complexity review skill (`templates/.agents/skills/complexity-review/`)

### Changed

- Lane SKILL template references `defer:` convention
- Bootstrap copies optional `.agents/skills/` tree

## [1.0.0] - 2026-06-15

Initial portable bundle extracted from OrbitaDev + Powerhouse practices.
