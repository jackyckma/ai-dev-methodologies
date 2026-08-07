# Project Agent Guidelines

Customize this file for **this repository**. Shared methodologies live in `.agents/instructions/` (from [ai-dev-methodologies](https://github.com/jackyckma/ai-dev-methodologies)).

## Communication language

- Respond to the user in **<!-- set per project, e.g. Traditional Chinese (繁體中文) or English -->** unless they ask for another language.
- Keep code, commands, file paths, and quoted source in original language.

## Stack

| Item | Value |
|------|-------|
| Language / framework | <!-- e.g. TypeScript, Next.js --> |
| Package manager | <!-- e.g. pnpm --> |
| Test runner | <!-- e.g. vitest --> |

## Git branching

| Branch | Purpose |
|--------|---------|
| `main` | Production / deploy branch |
| `feat/*` | Feature branches |

Workflow: branch from `main` → PR → `main`.

## Deploy (optional — founder defaults)

| Item | Value |
|------|-------|
| Platform | Zeabur (GitHub-linked) |
| Zeabur project ID | <!-- ask founder if missing --> |
| Service ID | <!-- ask founder if missing --> |
| Public URL | <!-- e.g. https://myapp.zeabur.app --> |
| Deploy branch | `main` |

Load Zeabur agent skills when doing deploy/log/env operations. Ask for IDs — do not guess.

## DNS / email (optional)

| Item | Value |
|------|-------|
| DNS provider | Cloudflare |
| Domain | <!-- example.com --> |
| Cloudflare token | Ask founder when DNS changes needed — never commit |

## AI providers (optional)

| Provider | Env var | Default? |
|----------|---------|----------|
| Minimax | `MINIMAX_API_KEY` | ✅ preferred |
| OpenAI | `OPENAI_API_KEY` | fallback |
| Anthropic | `ANTHROPIC_API_KEY` | fallback |
| OpenRouter | `OPENROUTER_API_KEY` | experiments |

## Adopted optional practices

<!-- Optional practices for this project. Empty = none adopted.
     - Tier E: .agents/instructions/agent-native-practices.md
     - Cursor Autopilot (B5): cursor-autopilot — docs/autopilot/ + Automations UI -->

## Documentation to read before non-trivial work

1. `docs/README.md`
2. `docs/CURRENT_STATUS.md`
3. `docs/SESSION_HANDOFF.md` (when resuming)
4. `docs/AGENT_ENV.md` (local vs Cloud Agent capabilities)
5. Domain docs as needed

Update status docs in the same session when behavior or capabilities change materially.

## Spec implementation notes

When implementing a written spec, maintain `implementation-notes.md` (or section in PR):

- Design decisions
- Deviations from spec
- Tradeoffs
- Open questions

Write notes in the project's communication language (set above).

## Verification before handoff

- Local / Cloud: `./scripts/agent-verify.sh` when present
- Cloud Agents: L0+L1 only unless AGENT_ENV says otherwise
- After deploy: smoke staging URL (L4)
