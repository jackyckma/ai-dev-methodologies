# Changelog

All notable changes to the methodology bundle. Projects pin their synced version in `.agents/METHODOLOGY.lock`.

Format based on [Keep a Changelog](https://keepachangelog.com/). Version follows semver on [VERSION](VERSION).

**Maintainers:** see [CHANGELOG-GUIDE.md](CHANGELOG-GUIDE.md) for release checklist and entry template.

## [1.2.0] - 2026-07-10

Agent-first maturity release, authored on branch `fable5/framework-upgrade-20260710`.
Background and rationale: `docs/fable5-audit/DIAGNOSIS.md`.

### Added

- `instructions/model-orchestration.md` — model/subagent dispatch contract, escalation ladder, verification-not-by-author (Tier C6)

### Changed

- `METHODOLOGIES.md`, `instructions/README.md` — index new instruction files

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
