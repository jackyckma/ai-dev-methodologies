#!/usr/bin/env bash
# Bootstrap ai-dev-methodologies into a target project.
# Usage: ./scripts/bootstrap-project.sh /path/to/target-repo [--force] [--reset-project-state]
# To update an existing project, use scripts/framework-sync.mjs (dry-run by default).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FORCE=0
RESET_PROJECT_STATE=0

# Live project data. --force does not overwrite these unless --reset-project-state.
PROJECT_STATE_PATHS=(
  ".agents/instructions/project-guidelines.md"
  "docs/AGENT_ENV.md"
  "scripts/agent-verify.sh"
  "docs/CURRENT_STATUS.md"
  "docs/SESSION_HANDOFF.md"
  "docs/autopilot/planner-preferences.md"
  "docs/autopilot/backlog.json"
  "docs/autopilot/roadmap.json"
  "docs/autopilot/decisions.json"
  "docs/autopilot/locks.json"
  "docs/autopilot/pause-state.json"
  "docs/autopilot/project-hooks.json"
  "docs/autopilot/watchdog-state.json"
)

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/target-repo [--force] [--reset-project-state]" >&2
  exit 1
fi

TARGET="$(cd "$1" && pwd)"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1 ;;
    --reset-project-state) RESET_PROJECT_STATE=1 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

is_project_state_dest() {
  local dest="$1"
  local rel="${dest#"$TARGET"/}"
  local p
  for p in "${PROJECT_STATE_PATHS[@]}"; do
    if [[ "$rel" == "$p" ]]; then
      return 0
    fi
  done
  return 1
}

copy_file() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    if is_project_state_dest "$dest" && { [[ "$RESET_PROJECT_STATE" -ne 1 ]] || [[ "$FORCE" -ne 1 ]]; }; then
      if [[ "$FORCE" -eq 1 ]]; then
        echo "skip (project-state; pass --reset-project-state with --force to overwrite): $dest"
      else
        echo "skip (exists): $dest"
      fi
      return 0
    fi
    if ! is_project_state_dest "$dest" && [[ "$FORCE" -ne 1 ]]; then
      echo "skip (exists): $dest"
      return 0
    fi
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "write: $dest"
}

copy_tree_instructions() {
  mkdir -p "$TARGET/.agents/instructions"
  for f in "$BUNDLE_ROOT/instructions/"*.md; do
    copy_file "$f" "$TARGET/.agents/instructions/$(basename "$f")"
  done
  copy_file "$BUNDLE_ROOT/METHODOLOGIES.md" "$TARGET/.agents/instructions/METHODOLOGIES.md"
}

write_methodology_lock() {
  local lock="$TARGET/.agents/METHODOLOGY.lock"
  if [[ -f "$lock" && "$FORCE" -ne 1 ]]; then
    echo "skip (exists): $lock"
    return 0
  fi
  local version synced_at source_commit
  version="$(cat "$BUNDLE_ROOT/VERSION" 2>/dev/null | tr -d '[:space:]' || echo "unknown")"
  synced_at="$(date +%Y-%m-%d)"
  source_commit="unknown"
  if git -C "$BUNDLE_ROOT" rev-parse HEAD &>/dev/null; then
    source_commit="$(git -C "$BUNDLE_ROOT" rev-parse --short HEAD)"
  fi
  mkdir -p "$(dirname "$lock")"
  cat > "$lock" <<EOF
# Methodology bundle pin — update only after a manual sync (see framework-adoption.md).

source: https://github.com/jackyckma/ai-dev-methodologies
version: "$version"
source_commit: $source_commit
synced_at: $synced_at
synced_by: bootstrap
lock_schema: 2
manifest_version: "$version"
customized_files:
  - .agents/instructions/project-guidelines.md
  - docs/AGENT_ENV.md
  - scripts/agent-verify.sh
notes: Initial bootstrap. Customize project-owned files before serious agent work. framework-sync --apply fills files hashes.
EOF
  echo "write: $lock"
}

copy_defaults() {
  mkdir -p "$TARGET/.agents/defaults"
  for f in "$BUNDLE_ROOT/defaults/"*.md; do
    copy_file "$f" "$TARGET/.agents/defaults/$(basename "$f")"
  done
}

echo "==> Bootstrapping ai-dev-methodologies into: $TARGET"
echo "    Bundle: $BUNDLE_ROOT"
if [[ "$FORCE" -eq 1 ]]; then
  echo "    Mode: --force (overwrite existing framework files)"
  if [[ "$RESET_PROJECT_STATE" -eq 1 ]]; then
    echo "    Mode: --reset-project-state (also overwrite project-state files)"
  else
    echo "    Project-state files are kept. Pass --reset-project-state to overwrite them too."
  fi
fi
if [[ "$RESET_PROJECT_STATE" -eq 1 && "$FORCE" -ne 1 ]]; then
  echo "    Note: --reset-project-state has no effect without --force" >&2
fi

copy_tree_instructions
copy_defaults
write_methodology_lock

copy_file "$BUNDLE_ROOT/compatibility/local-vs-cloud-agents.md" "$TARGET/.agents/compatibility/local-vs-cloud-agents.md"

copy_file "$BUNDLE_ROOT/templates/.agents/README.md" "$TARGET/.agents/README.md"
if [[ -d "$BUNDLE_ROOT/templates/.agents/skills" ]]; then
  mkdir -p "$TARGET/.agents/skills"
  for skill_dir in "$BUNDLE_ROOT/templates/.agents/skills"/*/; do
    [[ -d "$skill_dir" ]] || continue
    skill_name="$(basename "$skill_dir")"
    [[ "$skill_name" == "README.md" ]] && continue
    mkdir -p "$TARGET/.agents/skills/$skill_name"
    for f in "$skill_dir"*; do
      [[ -f "$f" ]] || continue
      copy_file "$f" "$TARGET/.agents/skills/$skill_name/$(basename "$f")"
    done
  done
  copy_file "$BUNDLE_ROOT/templates/.agents/skills/README.md" "$TARGET/.agents/skills/README.md"
fi
copy_file "$BUNDLE_ROOT/templates/AGENTS.md" "$TARGET/AGENTS.md"
copy_file "$BUNDLE_ROOT/templates/CLAUDE.md" "$TARGET/CLAUDE.md"
copy_file "$BUNDLE_ROOT/templates/.cursor/rules/shared-instructions.mdc" "$TARGET/.cursor/rules/shared-instructions.mdc"
copy_file "$BUNDLE_ROOT/templates/project-guidelines.template.md" "$TARGET/.agents/instructions/project-guidelines.md"

for doc in README.md CURRENT_STATUS.md SESSION_HANDOFF.md; do
  copy_file "$BUNDLE_ROOT/templates/docs/$doc" "$TARGET/docs/$doc"
done

copy_file "$BUNDLE_ROOT/compatibility/agent-capability-matrix.template.md" "$TARGET/docs/AGENT_ENV.md"
copy_file "$BUNDLE_ROOT/templates/scripts/agent-verify.sh" "$TARGET/scripts/agent-verify.sh"
copy_file "$BUNDLE_ROOT/scripts/setup-cloud-agent-env.sh" "$TARGET/scripts/setup-cloud-agent-env.sh"
chmod +x "$TARGET/scripts/agent-verify.sh" "$TARGET/scripts/setup-cloud-agent-env.sh" 2>/dev/null || true

# Optional Cursor Autopilot scaffolds (Maker/Checker loop). Safe to skip-exists.
if [[ -d "$BUNDLE_ROOT/templates/docs/autopilot" ]]; then
  mkdir -p "$TARGET/docs/autopilot/reports" "$TARGET/scripts/autopilot"
  for f in "$BUNDLE_ROOT/templates/docs/autopilot/"*; do
    [[ -f "$f" ]] || continue
    copy_file "$f" "$TARGET/docs/autopilot/$(basename "$f")"
  done
  copy_file "$BUNDLE_ROOT/templates/docs/autopilot/reports/README.md" "$TARGET/docs/autopilot/reports/README.md"
  for f in "$BUNDLE_ROOT/templates/scripts/autopilot/"*.mjs; do
    [[ -f "$f" ]] || continue
    copy_file "$f" "$TARGET/scripts/autopilot/$(basename "$f")"
  done
fi

echo ""
echo "==> Done. Next steps:"
echo "  1. Edit $TARGET/.agents/instructions/project-guidelines.md"
echo "  2. Edit $TARGET/docs/AGENT_ENV.md (verification commands, staging URL)"
echo "  3. Customize $TARGET/scripts/agent-verify.sh (VERIFY_L0 / VERIFY_L1)"
echo "  4. Optional Autopilot: read docs/autopilot/README.md + .agents/instructions/cursor-autopilot.md;"
echo "     create two Cursor Automations from docs/autopilot/automations.md"
echo "  5. Commit and push"
echo ""
echo "To update an existing project, do not re-run this script with --force."
echo "Use framework-sync (dry-run unless you pass --apply):"
echo "  node $BUNDLE_ROOT/scripts/framework-sync.mjs --project $TARGET"
echo "See instructions/framework-adoption.md. --force does not overwrite project-state"
echo "files unless you also pass --reset-project-state."
