# Changelog

All notable changes to the methodology bundle. Projects pin their synced version in `.agents/METHODOLOGY.lock`.

Format based on [Keep a Changelog](https://keepachangelog.com/). Version follows semver on [VERSION](VERSION).

**Maintainers:** see [CHANGELOG-GUIDE.md](CHANGELOG-GUIDE.md) for release checklist and entry template.

## [1.2.0] - 2026-07-10

Agent-first maturity release, authored on branch `fable5/framework-upgrade-20260710`.
Background and rationale: `docs/fable5-audit/DIAGNOSIS.md`.

### Added

- `instructions/model-orchestration.md` — model/subagent dispatch contract, escalation ladder, verification-not-by-author (Tier C6)
- `instructions/judgment-rubrics.md` — externalized judgment: done / stuck / escalate / ask rubrics, each with a positive and a negative example (Tier A8)
- `instructions/autonomous-loop.md` — unattended issue-queue protocol: preconditions, loop log, stop conditions, batch exit report (Tier B4)
- `instructions/framework-evolution.md` — maintainer process: intake, proposal format, upstream harvest, release coherence checklist (Tier A9)

### Changed

- `METHODOLOGIES.md`, `instructions/README.md` — index new instruction files; judgment-rubrics added to session-start reading order
- `instructions/decision-authority.md` — rewritten as three tiers (decide-and-log, queue-for-batch, block-and-ask) with decision-brief format and deferral tactics
- `instructions/lane-based-development.md` — §10 now points to decision-authority.md instead of duplicating it
- `instructions/session-handoff.md`, `templates/docs/SESSION_HANDOFF.md` — added "Pending decisions" section for batched decision briefs
- `templates/AGENTS.md`, `templates/CLAUDE.md`, `templates/.cursor/rules/shared-instructions.mdc`, `templates/.agents/README.md` — entry-point parity: identical core reading list in all three tools; single file→trigger map lives in `.agents/README.md`; Cursor rule no longer hardcodes a response language (set it in `project-guidelines.md`)
- `instructions/framework-adoption.md` — §2 marked as the **canonical** framework-owned sync list; new instruction files added to it
- `CHANGELOG-GUIDE.md` — framework-owned path list replaced by a pointer to framework-adoption §2; release gate now includes the framework-evolution coherence checklist

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
