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
distinguishes always-loaded (four core files) from load-on-demand (the
trigger map in `.agents/README.md`) — keep that boundary. Before adding any
new always-loaded line, ask: does every session need this? If not, it
belongs in the trigger map with a condition ("read when X"). If
session-start required reading exceeds roughly 300 lines total, weaker
models start skimming — which is worse than not shipping the file.

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

- This session ran in Claude Cowork with subagent support (Agent tool); the
  wrap-up adversarial review used a fresh-context subagent (5 blocking + 7
  minor findings, all addressed except the pre-existing items below). If
  your environment lacks subagents, substitute: finish writing, then
  re-read every changed file from disk in a fresh pass and check it against
  DIAGNOSIS.md before pushing.
- Commits on this branch were made via the GitHub API (Cowork sandbox has
  no push credentials). Two side effects: author metadata looks unusual,
  and **`scripts/bootstrap-project.sh` lost its executable bit** (now
  100644). Founder: run `chmod +x scripts/bootstrap-project.sh && git
  commit` after merging, or invoke it with `bash` in the meantime.
- Known pre-existing issues left for the founder (do not "fix" without
  asking):
  1. Language mix in `CHANGELOG-GUIDE.md` (notify templates),
     `framework-adoption.md` §6, and lane doc §9/§15 — new content is
     English-only by the founder's rule; old Chinese strings were left
     untouched.
  2. `bootstrap-project.sh` copies `METHODOLOGIES.md` into
     `.agents/instructions/`, where its repo-root-relative links
     (`instructions/…`, `templates/…`, `compatibility/…`) break. Tagged
     here as an `upstream-candidate:` for the next release to fix
     deliberately (e.g. rewrite links on copy, or copy to repo root).

## 4. Where session A-work ended (wrap-up status, 2026-07-10)

**Everything planned was completed and released as v1.2.0 on this branch.**
Nothing is half-finished. Shipped, in order:

1. `[B]` `docs/fable5-audit/DIAGNOSIS.md` — top-3 weaknesses (W1 human-as-scheduler, W2 undefined done/stuck, W3 self-drift)
2. `[C]` this letter
3. `[A]` `model-orchestration.md` (C6), `judgment-rubrics.md` (A8),
   `decision-authority.md` three-tier rewrite + lane §10 dedup,
   `autonomous-loop.md` (B4), entry-point parity across
   AGENTS/CLAUDE/Cursor + trigger map in `.agents/README.md`,
   `framework-evolution.md` (A9) + canonical sync list, `agent-native-practices.md`
   (Tier E, optional), template/README consistency fixes, VERSION 1.2.0 +
   full CHANGELOG section
4. Adversarial review fixes: tier terminology unified (no more "Important
   list"), karpathy §1 routes "ask" through decision tiers, guardrails
   added to reading order, `local-vs-cloud-agents.md` now ships to
   projects, loop-log section added to the handoff template, notify text
   in English

**The branch is NOT merged to main** — founder review pending, as
instructed.

**Next session, pick up here:**

1. Founder reviews `main...fable5/framework-upgrade-20260710`, merges, then
   `chmod +x scripts/bootstrap-project.sh` and optionally tags `v1.2.0`.
2. Sync the downstream projects (orbita, ai-transformation-io, powerhouse,
   ai-business, OrbitaDev) per `framework-adoption.md` §3 — the 1.2.0
   notify text in CHANGELOG.md is ready to paste.
3. During each sync, fill `VERIFY_L0`/`VERIFY_L1` and the AGENT_ENV model
   table where missing (§1.2 above — highest-leverage follow-up).
4. In a few weeks: first upstream harvest (`framework-evolution.md` §4),
   which should also pick up the two pre-existing issues in §3.
