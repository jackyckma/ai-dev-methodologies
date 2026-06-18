# Changelog guide (maintainer)

How to release a methodology update so bootstrapped projects (and their agents) know what changed and how to sync.

Target audience: **you** when editing `ai-dev-methodologies`. Agents read the resulting [CHANGELOG.md](CHANGELOG.md) during manual sync.

---

## Quick checklist

Before telling projects to update:

- [ ] Changes committed on `main`
- [ ] [VERSION](VERSION) bumped (semver)
- [ ] New section added at **top** of [CHANGELOG.md](CHANGELOG.md) (newest first)
- [ ] Each changed **framework-owned** path named (see below)
- [ ] `[breaking]` or **Migration** section if projects must do more than copy files
- [ ] [METHODOLOGIES.md](METHODOLOGIES.md) version table updated (if bundle version line exists)
- [ ] Optional: git tag `vX.Y.Z` and push

Then notify each project (5–8 is fine manually):

> Methodology 更新到 **vX.Y.Z**。請依 `framework-adoption.md` §3 sync。

---

## When to bump which number

| Bump | When | Example |
|------|------|---------|
| **Patch** `1.0.x` | Wording, typos, clarifications, no new files | Fix decision-authority typo |
| **Minor** `1.x.0` | New instruction, skill, defaults section, bootstrap behavior | Add `founder-shipping-strategy.md` |
| **Major** `x.0.0` | Rename/move core paths, change bootstrap layout, behavior projects rely on | Move all instructions to `policies/` |

When unsure between patch and minor: **minor** if agents should notice a new file to copy.

---

## What to write in CHANGELOG

Use [Keep a Changelog](https://keepachangelog.com/) sections. **Only include what matters to downstream projects.**

### Added

New files or capabilities projects may want to copy.

```markdown
### Added

- `instructions/founder-shipping-strategy.md` — ship-first posture (optional adopt)
- `templates/.agents/skills/stack-health-check/SKILL.md`
```

Always use **paths from the framework repo**, not paths inside a target project.

### Changed

Existing framework-owned files modified. **List the path** so sync agents know what to overwrite.

```markdown
### Changed

- `instructions/decision-authority.md` — decision brief template for Important tier
- `scripts/bootstrap-project.sh` — writes METHODOLOGY.lock on first bootstrap
```

### Deprecated

Still present but will be removed later. Tell projects not to depend on it.

### Removed

File deleted. Say what replaces it.

```markdown
### Removed

- `instructions/old-name.md` — replaced by `instructions/new-name.md`
```

### Migration

Use when **Major** or when minor needs manual steps (hybrid merges, renames).

```markdown
### Migration

1. Copy new `instructions/framework-adoption.md` if missing.
2. Rename local reference from `old-name.md` to `new-name.md` in project-guidelines (project-owned — do not overwrite).
3. Hybrid: merge new rows from upstream `docs/AGENT_ENV.md` template into project `docs/AGENT_ENV.md`.
```

Prefix breaking items with **`[breaking]`** in the bullet or section title.

### Skipped (optional section)

Help agents skip irrelevant work:

```markdown
### Skipped for non-lane projects

- `instructions/lane-based-development.md` — no action if project does not use lanes
```

---

## Entry template (copy for each release)

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- `path/to/file.md` — one-line why it exists

### Changed

- `path/to/file.md` — one-line what changed

### Migration

- [breaking] … (only if needed)

### Notify text

> Methodology 更新到 **vX.Y.Z**。<one sentence: main thing projects should do.>
```

Delete the **Notify text** subsection from CHANGELOG before commit if you prefer — or keep it as your copy-paste message to each project.

---

## Framework-owned paths (sync list)

When you change any of these, **name them in Changed/Added/Removed**:

```text
VERSION
CHANGELOG.md
METHODOLOGIES.md
instructions/*.md
defaults/*.md
templates/.agents/README.md
templates/.agents/skills/**/SKILL.md
templates/.agents/METHODOLOGY.lock   # template only; projects keep their own lock
templates/AGENTS.md
templates/CLAUDE.md
templates/.cursor/rules/shared-instructions.mdc
templates/project-guidelines.template.md   # does NOT overwrite project project-guidelines.md
templates/docs/*.md                      # templates only; not project live docs
templates/scripts/agent-verify.sh
compatibility/*.md
scripts/bootstrap-project.sh
scripts/setup-cloud-agent-env.sh
```

Do **not** expect projects to pull changes to `project-guidelines.md`, `docs/CURRENT_STATUS.md`, etc. — those are project-owned.

---

## Release workflow (minimal)

```bash
# 1. Edit files on main
# 2. Bump VERSION
echo "1.2.0" > VERSION

# 3. Add CHANGELOG section (newest at top)
# 4. Commit
git add -A
git commit -m "Release methodology v1.2.0"

# 5. Tag (optional but helps agents checkout exact version)
git tag v1.2.0
git push && git push --tags
```

---

## Semver ↔ project action (for notify message)

| Version | Tell projects |
|---------|----------------|
| Patch | 「可選 sync；主要是文字修正」或「建議 sync 這 N 個檔」 |
| Minor | 「請 sync；新增了 X，請 copy 新檔 Y」 |
| Major | 「請先讀 Migration；完成後 sync 並更新 lock」 |

---

## Anti-patterns

| Don't | Why |
|-------|-----|
| Release without CHANGELOG entry | Agents cannot know what to copy |
| Vague bullets ("improved docs") | Name the file path |
| Bump major for every change | Fatigue; projects defer sync |
| Forget to list bootstrap/script changes | Silent drift in lock or copy behavior |
| Only update VERSION, not CHANGELOG | Lock version and notes diverge |

---

## See also

- [framework-adoption.md](instructions/framework-adoption.md) — how **projects** apply an update
- [README.md](README.md) — bootstrap quick start
