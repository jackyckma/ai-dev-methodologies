## Learned User Preferences

- Communicate in Traditional Chinese unless the user specifies otherwise.
- Proceed autonomously on trivial or non-critical actions; escalate only for critical decisions.
- When escalating, provide a decision brief with product impact, options, tradeoffs, and a recommendation—not bare questions.
- Prefer conservative, incremental methodology changes; preserve the existing spec/contract-first design over major external imports.
- Use this bundle's own naming conventions (e.g. `defer:`) rather than external project names when integrating ideas.
- Prioritize autonomous AI-first development and code quality over token savings.
- Default infra stack: GitHub repo → Zeabur deploy (GitHub-linked) → Cloudflare DNS/domain; automate via tokens/APIs where possible.
- AI-first shipping posture: build and ship to staging first; defer market validation unless a decision has high reversal cost (new paid service, significant API cost, manual integration, irreversible schema).
- Framework updates to downstream projects are manual founder notifications (~5–8 projects); no automatic import or sync bots.
- New GitHub/Zeabur project creation only when the founder explicitly requests project bootstrap—not during routine sessions.

## Learned Workspace Facts

- Repo `jackyckma/ai-dev-methodologies` is a portable AI dev methodology bundle copied into target projects via `scripts/bootstrap-project.sh` (not a submodule).
- `main` is at v1.1.0; remote branch `fable5/framework-upgrade-20260710` carries a v1.2.0 agent-first maturity upgrade pending merge to main.
- Framework versioning uses `VERSION`, `CHANGELOG.md`, `instructions/framework-adoption.md`, and per-project `.agents/METHODOLOGY.lock`.
- Manual sync replaces framework-owned files only; never `--force` bootstrap on active projects (preserves `project-guidelines.md` and live docs).
- `templates/AGENTS.md` is the bootstrap template for target projects; workspace root `AGENTS.md` is Cursor learned memory for this repo.
- Optional founder defaults live in `defaults/` (Zeabur, Cloudflare); typical LLM default is Minimax with OpenAI/Gemini/Anthropic/OpenRouter also available.
- Bundled optional agent skills include `complexity-review` and `deferred-shortcuts` under `templates/.agents/skills/`.
