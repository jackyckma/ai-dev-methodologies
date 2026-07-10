# Letter to future sessions — from the Fable 5 upgrade session (2026-07-10)

You are probably a smaller model (Sonnet / Opus / Haiku / Codex / Cursor)
working on this framework or on a project that uses it. This letter records
what one high-capability session judged most important for this environment —
including things the founder did not ask about. Read `DIAGNOSIS.md` in this
directory first; it explains why this branch exists.

---

## 1. Three things the founder did not ask, but matter most

### 1.1 There is no feedback loop from projects back into the framework

Updates flow framework → projects only. Every downstream project accumulates
`docs/errors-and-learnings.md` entries, `defer:` markers, and workarounds —
and none of it ever returns upstream. The framework will fossilize while the
projects learn. `instructions/framework-evolution.md` (added on this branch)
includes a harvest step; the founder should actually trigger it every few
weeks by asking any agent: *"Run the upstream harvest per
framework-evolution.md §4."* If that section is ever removed, this problem
silently returns.

### 1.2 Verification infrastructure, not instructions, is the autopilot bottleneck

Every rubric on this branch reduces to "verify before claiming". That only
works if the project has something cheap to verify **with**. A project whose
`agent-verify.sh` still has empty `VERIFY_L0` / `VERIFY_L1` cannot run any
autopilot posture — the rubrics degrade to self-review theatre. Treat
filling L0/L1 (and a staging L4 smoke URL) as the **first issue of every new
project**, before feature work. When the founder asks "why does agent quality
vary across my projects", check this first.

### 1.3 Context budget is a finite resource that this framework spends

Each session adds instruction files; entry points accumulate imports. Claude
Code `@import` lines in CLAUDE.md are loaded **every session whether needed
or not**; Cursor `alwaysApply` rules likewise. The framework now
distinguishes always-loaded (thin entry points) from load-on-demand
(everything else) — keep that boundary. Before adding any new always-loaded
line, ask: does every session need this? If not, it belongs in the index
with a trigger condition ("read when X"). If session-start required reading
exceeds roughly 300 lines total, weaker models start skimming — which is
worse than not shipping the file.

---

## 2. How this system will most likely degrade, and the countermeasures

| Degradation | Mechanism | Countermeasure (already in place) |
|---|---|---|
| Entry-point drift | Someone edits AGENTS.md but not CLAUDE.md / Cursor rule | Parity rule + release coherence checklist in `framework-evolution.md`; never edit one entry point alone |
| Invisible files | New instruction merged but never indexed in METHODOLOGIES.md | Hard rule: unindexed = unwritten; checklist item at release |
| Rubric erosion | Weak models append exceptions or "simplify" rubrics mid-task | Instruction files change only via the framework-evolution process, never as a drive-by during project work |
| Optional → default creep | Tier E optional practices copy-pasted into projects as if required | Optional files carry an explicit adoption gate (must be listed in the project's `project-guidelines.md`) |
| Silent releases | "Small" edits skip CHANGELOG/VERSION | CHANGELOG-GUIDE anti-pattern table + coherence checklist; no framework-owned change without a CHANGELOG line |
| Model-name rot | Orchestration doc hardcodes model names that stop existing | `model-orchestration.md` mandates a per-environment model table verified at session start; treats names as data, not doctrine |
| Two sources of truth | A second "framework-owned paths" list reappears | `framework-adoption.md` §2 is canonical; everything else must link, not copy |

## 3. Environment notes for future maintenance sessions

- This session ran in Claude Cowork with subagent support (Agent tool);
  the wrap-up adversarial review used a fresh-context subagent. If your
  environment lacks subagents, substitute: finish writing, then re-read
  every changed file from disk in a fresh pass and check it against
  DIAGNOSIS.md before pushing.
- Commits on this branch were made via the GitHub API (Cowork sandbox has
  no push credentials). Author metadata may look unusual; content is what
  matters.
- Known pre-existing issue left for the founder: mixed English/Chinese in
  `CHANGELOG-GUIDE.md`, `framework-adoption.md` §6, and the Cursor template.
  New content is English-only by the founder's rule. Do not "helpfully"
  translate old content without being asked.

## 4. Where session A-work ended (updated at wrap-up)

> Status as of final wrap-up — see bottom of file. If this section still
> says PLACEHOLDER, the session was cut off before wrap-up; check
> `git log fable5/framework-upgrade-20260710` for the last completed item
> and resume from the priority order at the end of DIAGNOSIS.md.

PLACEHOLDER — updated at end of session.
