# AI Dev Methodologies

Portable development methodologies for projects built with **Cursor**, **Claude Code**, and **Codex** — independent of any specific orchestrator (e.g. OrbitaDev).

## Quick start

Bootstrap an existing project:

```bash
git clone https://github.com/jackyckma/ai-dev-methodologies.git /tmp/ai-dev-methodologies
/tmp/ai-dev-methodologies/scripts/bootstrap-project.sh /path/to/your-project
```

Or use this repo as a [GitHub template](https://github.com/jackyckma/ai-dev-methodologies/generate) when creating a new repository.

## What's inside

| Path | Purpose |
|------|---------|
| [METHODOLOGIES.md](METHODOLOGIES.md) | Master index — Tier A–E methodology catalog |
| [instructions/](instructions/) | Canonical agent instruction files |
| [defaults/](defaults/) | Optional founder defaults (Zeabur, Cloudflare, AI providers) |
| [compatibility/](compatibility/) | Local Cursor vs Cloud Agents workflow |
| [templates/](templates/) | Files copied into target projects by bootstrap |
| [scripts/](scripts/) | `bootstrap-project.sh`, `setup-cloud-agent-env.sh` |

## Agent entry points (after bootstrap)

Target projects get thin wrappers that point to `.agents/instructions/`:

- `AGENTS.md` — Codex / OpenAI agents
- `CLAUDE.md` — Claude Code / Claude cloud
- `.cursor/rules/shared-instructions.mdc` — Cursor

## Optional founder defaults

Most projects by this founder use:

- **Zeabur** — GitHub-linked managed deploy
- **Cloudflare** — DNS and email
- **Minimax** — default LLM API (OpenAI, Gemini, Anthropic, OpenRouter also available)

See [defaults/README.md](defaults/README.md). These are **optional** — override or omit per project.

## Version

Methodology bundle **1.0** (2026-06-15). Extracted from practices validated on OrbitaDev and Powerhouse, generalized for any AI-assisted repo.
