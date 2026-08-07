---
status: active
maintained_by: ai-agents
purpose: Shared contract for projects that report into a portfolio hub (Orbita) — six fixed sections, two edges, opt-in gate, evolution process.
---

# Portfolio hub reporting (Tier B6, optional)

> **For AI agents:** Read this when a project is asked to "report to the hub", "expose a report endpoint", "enable `orbita_hub`", or when you are writing a period report. If the project has not opted in (§3), this file does not apply — do not add reporting surfaces speculatively.

The founder runs several projects in parallel and cannot hold them all in
working memory at once. A hub (currently **Orbita**) collects reports so a
single agent session can brief across the portfolio without crawling every repo
and every dashboard.

**The whole value is comparability.** Six projects with six bespoke report
shapes is worse than no reports at all, because the reader must re-learn each
one. That is why this contract is framework-owned: a project may choose
*whether* to report, never *what shape* the report has.

---

## 1. Two edges — this is the part that is easy to get wrong

A project emits **two kinds** of state, and they live in different places:

| | **Repo edge** | **Runtime edge** |
|---|---|---|
| Question | What did development do? | What is the live product doing? |
| Knows about | merged PRs, backlog health, `needs_human` tasks, decisions, Autopilot runs | traffic, signups, queue depth, error rates, jobs/harnesses, content pipeline |
| Source of truth | the git repo | the running service and its database |
| Who generates | Cursor Autopilot Checker, in-repo | the service itself, at request time |
| Transport | **file** — commit `docs/autopilot/reports/latest.json` | **HTTP** — `GET /orbita/report` on the service |

Neither can substitute for the other. **A production service does not know what
is in `backlog.json`; a git repo does not know last night's error rate.**
Trying to serve both from one place is the failure mode this section exists to
prevent.

A project may publish **one or both**. Most start with the repo edge (free, no
new infrastructure) and add the runtime edge when the live product has signals
worth steering on.

The hub fetches whichever edges a project publishes and merges them per project
per period. Same envelope, same sections, different `edge` value.

---

## 2. Direction of travel

```text
project repo     ──file──┐
                         ├──▶  hub  ──brief──▶  founder + agent discussion
project runtime  ──HTTP──┘      │
                                └──instruction──▶  project's Autopilot backlog
```

Reports are **pull**: the hub fetches on a schedule. A project never needs an
outbound hub client, hub credentials, or any knowledge that the hub exists
beyond serving the contract.

Instruction dispatch (the return path) is **not** covered here — it goes through
the project's `docs/autopilot/backlog.json`, gated by founder discussion. A
report is read-only output.

---

## 3. Opt-in gate

A project reports only if **both** are true:

1. `docs/autopilot/project-hooks.json` contains `"orbita_hub": true`
2. The project's `project-guidelines.md` § Adopted optional practices lists
   `portfolio-hub-reporting`

Declare which edges are enabled:

```json
{
  "orbita_hub": true,
  "orbita_hub_project_slug": "ai-business",
  "orbita_hub_edges": ["repo"]
}
```

Absent the gate, agents must **not** add a report file, an endpoint, or
report-shaped docs. An unrequested reporting surface is scope creep and, for the
runtime edge, new attack surface.

---

## 4. The six sections (fixed)

Every report — either edge — has exactly these six sections in this order. Do
not add, rename, reorder, or drop them. The *questions* are constant; what fills
them depends on the edge.

| `id` | Title | Repo edge fills with | Runtime edge fills with |
|------|-------|----------------------|-------------------------|
| `intent_vs_actual` | Intent vs last period | Did we build what last period's `ask` said? | Did the live product behave as expected? |
| `shipped` | Shipped / delivered | Merged PRs, deploys | What the runtime produced — published content, jobs completed, orders served |
| `needs_founder` | Blocked / needs founder | `needs_human` tasks, open decisions past SLA | Runtime calls only a human can make — stuck queue, content to approve, spend to authorise |
| `autopilot` | Automation health | Maker/Checker runs, task states, locks | Harness / cron / worker health, last successful run, backlog depth |
| `risks` | Risks / drift | Repeated retries, stale `ready` tasks, scope wander | Error rates, degradation, cost trend, abuse |
| `ask` | Ask | **At most one** recommended next instruction | **At most one** recommended next instruction |

Rules:

- An empty section keeps its key with body `"none"`. **Never omit a key** — a
  missing key is indistinguishable from a broken generator, and briefs stop
  being comparable.
- `needs_founder` is the section the founder actually reads. Padding it with
  agent-decidable items is the fastest way to make the whole report ignored.
- `ask` is capped at one **per edge**, on purpose. If everything is the top ask,
  nothing is.
- Project-specific colour goes **inside** these sections, never as a seventh
  parallel section.

---

## 5. Payload

```json
{
  "schema_version": "1.1",
  "project": "ai-business",
  "edge": "repo",
  "generated_at": "2026-08-07T14:00:00Z",
  "period": { "since": "2026-08-06T00:00:00Z", "until": "2026-08-07T00:00:00Z" },
  "status": "ok",
  "sections": [
    { "id": "intent_vs_actual", "title": "Intent vs last period", "body": "..." },
    { "id": "shipped",          "title": "Shipped / delivered",   "body": "..." },
    { "id": "needs_founder",    "title": "Blocked / needs founder", "body": "none" },
    { "id": "autopilot",        "title": "Automation health",     "body": "..." },
    { "id": "risks",            "title": "Risks / drift",         "body": "none" },
    { "id": "ask",              "title": "Ask",                   "body": "..." }
  ]
}
```

| Field | Rule |
|-------|------|
| `schema_version` | `"1.1"`. Bump only via §8. |
| `project` | Stable lowercase slug, matches the hub registry. Never rename casually — the hub keys history on it. |
| `edge` | `repo` \| `runtime`. Optional; absent means `repo` (back-compat with 1.0). |
| `generated_at` | ISO-8601 UTC. |
| `period` | `{since, until}` ISO-8601 UTC. `since` inclusive, `until` exclusive. |
| `status` | `ok` \| `degraded` \| `failed`. Health of **report generation**, not of the product — product problems belong in `risks`. |
| `sections[]` | Exactly six, in §4 order. `body` is Markdown. Optional `items[]` of `{text, url}`. |

Machine-checkable: [`report.schema.json`](../templates/docs/autopilot/report.schema.json).
Worked example: [`report.example.json`](../templates/docs/autopilot/report.example.json).

---

## 6. Transports

### 6a. Repo edge — file (no new infrastructure)

Write the payload to `docs/autopilot/reports/latest.json` and commit it to
`main`. The hub reads it through the git host. Generate it at the end of a
Checker run, or as its own scheduled Automation. Keep dated copies alongside
(`reports/2026-08-07.json`) if useful; `latest.json` is what the hub reads.

No endpoint, no credential, no attack surface, and git provides history for
free. Every project with a repo can do this on day one — including projects with
no running service at all.

### 6b. Runtime edge — HTTP

```text
GET /orbita/report?since=<ISO>&until=<ISO>
Authorization: Bearer <per-project read-only token>
→ 200 application/json   (payload above, "edge": "runtime")
```

Rules:

- **Read-only.** Never mutates state, never accepts instructions. The return
  path is the Autopilot backlog, not this endpoint.
- **Its own credential**, scoped to this route only. Never reuse an admin token.
  The hub holds it in its vault; not shared between projects.
- `since` / `until` optional; default to the last 24h.
- Missing or bad auth → `401`, never a partial payload.
- If the service cannot build a real report (data source down), return `200`
  with `"status": "failed"` and the reason in `intent_vs_actual`. Prefer an
  honest failed report over a `500` — the hub can then distinguish "this project
  is unhealthy" from "this project is unreachable".
- Extend by adding to `sections[]`, not by adding routes.

**Do not build the runtime edge speculatively.** It is worth it when the live
product has signals the founder would actually steer on. A pre-launch project
with no users has nothing to say here, and the endpoint is pure liability.

---

## 7. Who writes the content

Reports are **generated from observed state**, not hand-written. If a section
needs judgment, an agent may write prose — but prose about **what was observed**,
not aspiration. A report that reads like a pitch is a broken report.

---

## 8. Evolving this contract

This is v1 of a young contract; it **will** change. The rule is that it changes
**here**, once, for everyone — never in a product repo.

### Change classes

| Class | Examples | Version | Migration |
|---|---|---|---|
| **Clarification** | Better wording, new example, sharper section definition | patch — `1.1` → `1.1` (bundle version only) | None. Projects pick it up on next sync |
| **Additive** | New **optional** field; new optional `items[]` key; a section definition widened | minor — `1.1` → `1.2` | None forced. Old payloads stay valid. Hub must keep accepting the older shape |
| **Breaking** | Rename / remove / reorder a section; change a field's meaning; make an optional field required | major — `1.x` → `2.0` | Every reporting project must migrate; see below |

`edge` in v1.1 is the worked example of an **additive** change: it is optional
and defaults to `repo`, so every v1.0 payload is still a valid v1.1 payload and
nothing had to migrate on the day.

### Process for a breaking change

1. **Propose in the framework repo**, not in a product repo. Write what breaks
   and why the additive route was rejected — additive is almost always available
   and almost always better.
2. **Bump `schema_version` to the new major** in this file and in
   `report.schema.json`; write the CHANGELOG entry with notify text.
3. **The hub accepts both versions** for the whole migration window. This is
   the load-bearing rule: with several projects, they will never migrate on the
   same day, and a hub that accepts only the newest version blinds the founder
   to every project that has not caught up yet.
4. **Migrate projects one at a time**, each as a normal `ready` task in that
   repo's backlog. Pilot on one project and verify before fanning out.
5. **Retire the old version only when every reporting project has moved** —
   confirm by reading each project's latest report, not by assuming.

### Who decides

The founder, at the framework repo. An agent that finds the contract wrong
should say so in a PR or a `needs_founder` line — **not** patch its local copy.
A project that edits its own `report.schema.json` has silently left the
portfolio, and the hub will keep comparing it as though it had not.

---

## 9. Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Serving repo state from the runtime endpoint (or vice versa) | Each edge can only honestly answer about itself; the other half becomes invented |
| Inventing a seventh section for "our special case" | Kills comparability, the only reason the hub exists |
| Omitting empty sections | Reader cannot distinguish "nothing to report" from "generator broke" |
| Filling `needs_founder` with agent-decidable items | Founder stops reading the section that matters most |
| Several items in `ask` | No prioritisation happened; the founder has to do it again |
| Reusing an admin token for the report route | One leaked read credential becomes full control |
| Building the runtime edge before the product has signals | Public surface and a credential, in exchange for nothing |
| Locally editing `report.schema.json` | Project silently leaves the portfolio while still appearing in it |
| Hand-writing reports from memory | Hub then briefs the founder on fiction |

---

## 10. Version

Contract `schema_version` **1.1** (introduced in bundle 1.5.0; 1.0 introduced in
1.4.0 and remains valid). See [CHANGELOG.md](../CHANGELOG.md). Hub-side design
lives in `jackyckma/orbita docs/personal-steward/portfolio-hub.md`; if that doc
and this file disagree about the wire format, **this file wins** — the hub is
one consumer, the contract is shared.
