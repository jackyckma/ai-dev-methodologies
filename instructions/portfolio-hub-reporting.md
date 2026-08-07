---
status: active
maintained_by: ai-agents
purpose: Shared contract for projects that report into a portfolio hub (Orbita) — six fixed sections, two transports, opt-in gate.
---

# Portfolio hub reporting (Tier B6, optional)

> **For AI agents:** Read this when a project is asked to "report to the hub", "expose a report endpoint", "enable `orbita_hub`", or when you are writing a period report for a project that has opted in. If the project has not opted in (§2), this file does not apply — do not add reporting surfaces speculatively.

The founder runs several projects in parallel and cannot hold them all in
working memory at once. A hub (currently **Orbita**) collects one report per
project per period so a single agent session can brief across the portfolio
without crawling every repo.

**The whole value is comparability.** Six projects with six bespoke report
shapes is worse than no reports at all, because the reader must re-learn
each one. That is why this contract is framework-owned: a project may choose
*whether* to report, never *what shape* the report has.

---

## 1. Direction of travel

```text
project  ──report──▶  hub  ──brief──▶  founder + agent discussion
                       │
                       └──instruction──▶  project's Autopilot backlog
```

Reports are **pull**, not push: the hub fetches on a schedule. A project
never needs an outbound hub client, credentials for the hub, or knowledge
that the hub exists beyond serving the contract.

Instruction dispatch (the return path) is **not** covered here — it goes
through the project's normal `docs/autopilot/backlog.json`, gated by founder
discussion. A report is read-only output.

---

## 2. Opt-in gate

A project reports only if **both** are true:

1. `docs/autopilot/project-hooks.json` contains `"orbita_hub": true`
2. The project's `project-guidelines.md` § Adopted optional practices lists
   `portfolio-hub-reporting`

Absent either, agents must **not** add a report endpoint, a report file, or
report-shaped docs. An unrequested reporting surface is scope creep and, for
the HTTP transport, new attack surface.

---

## 3. The six sections (fixed)

Every report body has exactly these six sections, in this order, for every
project. Do not add, rename, reorder, or drop them.

| `id` | Title | Answers | Keep out |
|------|-------|---------|----------|
| `intent_vs_actual` | Intent vs last period | Did we do what we said we would? | Excuses; just the delta |
| `shipped` | Shipped / merged | What actually landed and deployed | Work in progress |
| `needs_founder` | Blocked / needs founder | Only items needing **human judgment**, each with a one-line impact | Anything an agent could decide itself |
| `autopilot` | Autopilot health | Last Maker/Checker runs, open / failed / `needs_human` tasks | Per-commit narration |
| `risks` | Risks / drift | Where the project is wandering from its goal | Speculative doom |
| `ask` | Ask | **At most one** recommended next instruction | A wishlist |

Rules:

- An empty section keeps its key with body `"none"`. **Never omit a key** —
  a missing key is indistinguishable from a broken generator, and briefs
  stop being comparable.
- `needs_founder` is the section the founder actually reads. Padding it with
  agent-decidable items is the fastest way to make the whole report ignored.
- `ask` is capped at one item on purpose. If everything is the top ask,
  nothing is.
- Project-specific colour goes **inside** these sections (e.g. an editorial
  queue depth belongs under `needs_founder` or `shipped`), never as a
  seventh parallel section.

---

## 4. Payload

```json
{
  "schema_version": "1.0",
  "project": "ai-business",
  "generated_at": "2026-08-07T14:00:00Z",
  "period": { "since": "2026-08-06T00:00:00Z", "until": "2026-08-07T00:00:00Z" },
  "status": "ok",
  "sections": [
    { "id": "intent_vs_actual", "title": "Intent vs last period", "body": "..." },
    { "id": "shipped",          "title": "Shipped / merged",      "body": "..." },
    { "id": "needs_founder",    "title": "Blocked / needs founder", "body": "none" },
    { "id": "autopilot",        "title": "Autopilot health",      "body": "..." },
    { "id": "risks",            "title": "Risks / drift",         "body": "none" },
    { "id": "ask",              "title": "Ask",                   "body": "..." }
  ]
}
```

| Field | Rule |
|-------|------|
| `schema_version` | `"1.0"`. Bump only via this file. |
| `project` | Stable slug, lowercase, matches the hub's registry. Never rename casually — the hub keys history on it. |
| `generated_at` | ISO-8601 UTC, when the report was produced. |
| `period` | `{since, until}` ISO-8601 UTC. `since` inclusive, `until` exclusive. |
| `status` | `ok` \| `degraded` \| `failed`. Report generation health, **not** product health — product problems belong in `risks`. |
| `sections[]` | Exactly six, in the §3 order. `body` is Markdown. Optional `items[]` of `{text, url}` for links. |

Machine-checkable schema: [`templates/docs/autopilot/report.schema.json`](../templates/docs/autopilot/report.schema.json).
Worked example: [`templates/docs/autopilot/report.example.json`](../templates/docs/autopilot/report.example.json).

---

## 5. Transports

Pick **one**. File transport is the default; add HTTP only when a project
already runs a service and the founder asks for live pulls.

### 5a. File transport (default)

Write the payload to `docs/autopilot/reports/latest.json` and commit it to
`main`. The hub reads it through the git host.

Use this when the project:

- has no running service, or is pre-UI / early stage
- has a service, but adding an authenticated public route is not worth it yet
- wants report history for free (git already versions it)

Generate it at the end of a Checker run, or as its own scheduled Automation.
Keep dated copies alongside if useful (`reports/2026-08-07.json`); `latest.json`
is the one the hub reads.

**This transport requires no new endpoint, no new credential, and no new
attack surface.** Prefer it until a project has a concrete reason not to.

### 5b. HTTP transport

```text
GET /orbita/report?since=<ISO>&until=<ISO>
Authorization: Bearer <per-project read-only token>
→ 200 application/json   (payload above)
```

Rules:

- **Read-only.** This route must never mutate state, and must never accept
  instructions. The return path is the Autopilot backlog, not this endpoint.
- **Its own credential**, scoped to this route only. Never reuse an admin
  token. The hub holds it in its vault; it is not shared between projects.
- `since` / `until` optional; default to the last 24h if omitted.
- Missing or bad auth → `401`, never a partial payload.
- If the project cannot produce a real report (data source down), return
  `200` with `"status": "failed"` and the reason in `intent_vs_actual`.
  Prefer an honest failed report over a `500` — the hub can then tell the
  difference between "this project is unhealthy" and "this project is
  unreachable".
- Extend by adding to `sections[]`, not by adding new routes.

---

## 6. Who writes the content

The report is **generated**, not hand-written, wherever possible:

| Section | Source |
|---------|--------|
| `intent_vs_actual` | Previous period's `ask` + roadmap `approved` epics |
| `shipped` | Merged PRs / deploys in the period |
| `autopilot` | `backlog.json` task states, `locks.json`, `watchdog-state.json`, recent run logs |
| `needs_founder` | Tasks in `needs_human`, open `decisions.json` entries past SLA |
| `risks` | `lessons.md`, repeated retries, stale `ready` tasks |
| `ask` | Highest-value next epic or decision, one only |

If a section genuinely needs judgment, an agent may write prose — but it must
be prose about **observed repo state**, not aspiration. A report that reads
like a pitch is a broken report.

---

## 7. Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Inventing a seventh section for "our special case" | Kills comparability, which is the only reason the hub exists |
| Omitting empty sections | Reader cannot distinguish "nothing to report" from "generator broke" |
| Filling `needs_founder` with agent-decidable items | Founder stops reading the section that matters most |
| Several items in `ask` | No prioritisation happened; the founder has to do it again |
| Reusing an admin token for the report route | One leaked read credential becomes full control |
| Adding the endpoint before opt-in | Unrequested public surface on a project nobody asked to expose |
| Hand-writing reports from memory | Drifts from repo reality; the hub then briefs the founder on fiction |

---

## 8. Version

Contract `schema_version` **1.0**, introduced in bundle **1.4.0**.
See [CHANGELOG.md](../CHANGELOG.md). Hub-side design lives in
`jackyckma/orbita docs/personal-steward/portfolio-hub.md`; if that doc and
this file disagree about the wire format, **this file wins** — the hub is one
consumer, the contract is shared.
