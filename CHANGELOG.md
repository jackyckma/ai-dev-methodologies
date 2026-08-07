# Changelog

All notable changes to the methodology bundle. Projects pin their synced version in `.agents/METHODOLOGY.lock`.

Format based on [Keep a Changelog](https://keepachangelog.com/). Version follows semver on [VERSION](VERSION).

**Maintainers:** see [CHANGELOG-GUIDE.md](CHANGELOG-GUIDE.md) for release checklist and entry template.

## [1.4.0] - 2026-08-07

Portfolio hub reporting (optional Tier B6). Lets several projects report into one hub in a comparable shape, so a single agent session can brief across the portfolio without crawling every repo.

### Added

- `instructions/portfolio-hub-reporting.md` — six-section report contract, payload spec, two transports (file default / HTTP optional), opt-in gate, anti-patterns
- `templates/docs/autopilot/report.schema.json` — JSON Schema for contract `schema_version` **1.0**; validates section set, order, and the "empty section keeps its key" rule
- `templates/docs/autopilot/report.example.json` — worked fixture including an empty section and a correctly written `needs_founder` item

### Changed

- `METHODOLOGIES.md` — Tier **B6** row, adoption-matrix row, optional-practice gate now names B5 and B6; **version table corrected** (said 1.2.0 while VERSION/README said 1.3.0)
- `instructions/README.md` — B6 index row
- `instructions/framework-adoption.md` — §2 canonical list adds `portfolio-hub-reporting.md`, `report.schema.json`, `report.example.json` as framework-owned; `docs/autopilot/reports/**` explicitly project-owned; `project-hooks.json` hybrid rule now mentions the `orbita_hub` opt-in; new anti-pattern for locally editing the schema
- `README.md`, `VERSION` → **1.4.0**

### Design notes

- **File transport is the default, HTTP is opt-in.** Most projects can commit `docs/autopilot/reports/latest.json` and get history from git — no new route, no new credential, no new attack surface. Early-stage projects with no running service can report from day one.
- **The section set is closed.** Six projects with six bespoke shapes is worse than no reports, because the reader re-learns each one. A project chooses whether to report, never what shape.
- **`status` describes report generation, not product health.** A project whose product is on fire still returns `status: ok` with the fire described under `risks` — otherwise the hub cannot distinguish "unhealthy" from "unreachable".

### Notify text

> Methodology updated to **v1.4.0**. New optional **Tier B6 portfolio hub reporting**: sync `.agents/instructions/portfolio-hub-reporting.md` + `docs/autopilot/report.schema.json` + `report.example.json`. Only implement a report generator if the project has opted in (`"orbita_hub": true` in `project-hooks.json` **and** listed in `project-guidelines.md` § Adopted optional practices). Prefer the file transport (`docs/autopilot/reports/latest.json`) unless the project already runs a service. **Do not** edit `report.schema.json` locally, and **do not** overwrite generated reports on sync.

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
