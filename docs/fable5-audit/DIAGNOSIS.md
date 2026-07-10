# Framework diagnosis — 2026-07-10 (Fable 5 session)

Scope: full read of `ai-dev-methodologies` at v1.1.0 (commit 61f94d4). The three
weakest points, ranked by impact on the framework's stated goal (approaching
autopilot coding with smaller models doing the work). Later changes on this
branch reference this document.

---

## W1. The human is the scheduler — every "Important" decision is a synchronous blocking ask, and there are no orchestration rules at all

**Evidence**

- `decision-authority.md`: the only mechanism for the Important tier is
  "stop and ask". No batching, no reversible-default path, no deferral.
- `karpathy-guidelines.md` §1: "If uncertain, ask" — with no counterweight
  describing when *not* to ask.
- Zero instruction files cover subagent dispatch, model selection, effort
  levels, escalation, or parallelism. The framework assumes one agent, one
  context, human-paced.

**Effect**

Agent-first in name, human-paced in practice. The founder gets interrupted
one question at a time; each interrupt stalls the run. Expensive models do
grunt work (repo scans, batch edits) inside the main context; cheap models
never get promoted work they could do. This is the single largest gap
between the current framework and the autopilot definition.

**Fix (implemented on this branch)**

1. `instructions/model-orchestration.md` — dispatch contract (goal +
   acceptance + report format), explicit model/effort table maintained per
   environment, escalation/de-escalation ladder, "commander stays out of the
   trenches", verification never by the author.
2. `instructions/decision-authority.md` upgraded — three tiers instead of
   two: decide-and-log (reversible default), queue-for-batch (decision
   brief, ask at the next natural sync point), block-and-ask (only for the
   irreversible list). Deferral by stub: implement behind a flag or with
   fixture data so the founder decides while looking at output.
3. `instructions/autonomous-loop.md` — a /loop-style protocol: work an
   agent-ready issue queue until a stop condition, not until the next
   question.

---

## W2. "Done", "stuck", and "wrong direction" are undefined — the judgment weaker models need most is exactly what is not written down

**Evidence**

- Completion: `issue-quality.md` requires testable AC (good), but nothing
  defines the *verification protocol* — an agent may claim done after
  self-review of its own diff. `agent-verify.sh` covers L0/L1 only and is
  optional in practice.
- Stuck: no rule distinguishes "retry", "change approach", and "escalate".
  A weak model that fails twice will happily fail a third time the same way.
- No rubric exists for when to escalate to a stronger model, what signals
  mean the plan itself is wrong, or what the minimum quality floor is before
  handoff.

**Effect**

Weaker models fail in the two expensive directions: stopping early with
"done" that doesn't survive contact with the verifier, or burning a session
looping on a dead approach. Both cost founder attention — the resource the
framework is supposed to conserve.

**Fix (implemented on this branch)**

`instructions/judgment-rubrics.md` — externalized judgment as checklists,
each judgment with one positive and one negative example: definition of
done (verify before claiming), retry/换路/escalate decision table,
wrong-direction signals, stop-and-ask triggers, quality floor.
`model-orchestration.md` adds the structural rule: acceptance checks run in
a fresh context, never by the author of the change.

---

## W3. The framework's own consistency depends on maintainer memory — and drift is already present at v1.1.0

**Evidence (all verifiable in the current tree)**

- `decision-authority.md` is indexed as Tier A6 in `METHODOLOGIES.md` but is
  referenced by **none** of the three entry-point templates
  (`templates/AGENTS.md`, `templates/CLAUDE.md`,
  `templates/.cursor/rules/shared-instructions.mdc`). A bootstrapped project
  ships a decision policy no agent is told to read.
- The three entry points list **different** instruction sets: AGENTS.md has
  framework-adoption but not decision-authority; CLAUDE.md has neither
  decision-authority nor issue-quality nor framework-adoption; the Cursor
  rule has neither decision-authority nor framework-adoption. Same repo,
  three different rulebooks depending on which tool opens it.
- `lane-based-development.md` §10 duplicates `decision-authority.md` almost
  verbatim — the exact anti-pattern its own §12 warns about ("Duplicating
  instructions in 5 agent files").
- Two divergent framework-owned path lists: `CHANGELOG-GUIDE.md` §sync-list
  vs `framework-adoption.md` §2. They already disagree (e.g. treatment of
  `templates/docs/*.md` and `agent-verify.sh`).
- `README.md` says "Tier A–E methodology catalog"; `METHODOLOGIES.md` has
  only A–D.
- Language mix: `CHANGELOG-GUIDE.md` and `framework-adoption.md` embed
  Traditional Chinese notify strings; the Cursor template hardcodes a
  Chinese response default. (Flagged for the founder; new content on this
  branch is English-only. Project communication language belongs in
  `project-guidelines.md`, not in framework defaults.)

**Effect**

Every future edit made by a smaller model will widen these cracks, because
nothing tells it the full set of places that must move together. This is the
mechanism by which the update process "漂移走樣".

**Fix (implemented on this branch)**

1. Entry-point parity: all three templates carry the same numbered
   instruction list; a parity checklist becomes a release-gate item.
2. One canonical framework-owned path list (in `framework-adoption.md` §2);
   `CHANGELOG-GUIDE.md` points to it instead of carrying a second copy.
3. `instructions/framework-evolution.md` — the intake ritual (founder
   request or external reference → analysis → proposal → merge) plus a
   release coherence checklist that any Sonnet-class model can execute
   mechanically.
4. The drift items above fixed directly (lane §10 → pointer; Tier E added;
   README corrected).

---

## Priority order for the rest of this branch

W1 fixes first (orchestration, decision tiers, loop), W2 second (rubrics),
W3 third (parity + evolution rules + drift fixes), then optional Tier E
material. Rationale: W1/W2 change what downstream agents *do* tomorrow;
W3 protects the framework itself over months.
