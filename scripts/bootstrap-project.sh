#!/usr/bin/env bash
# Bootstrap ai-dev-methodologies into a target project.
# Usage: ./scripts/bootstrap-project.sh /path/to/target-repo [--force]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FORCE=0

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/target-repo [--force]" >&2
  exit 1
fi

TARGET="$(cd "$1" && pwd)"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

copy_file() {
  local src="$1" dest="$2"
  if [[ -f "$dest" && "$FORCE" -ne 1 ]]; then
    echo "skip (exists): $dest"
    return 0
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

copy_defaults() {
  mkdir -p "$TARGET/.agents/defaults"
  for f in "$BUNDLE_ROOT/defaults/"*.md; do
    copy_file "$f" "$TARGET/.agents/defaults/$(basename "$f")"
  done
}

echo "==> Bootstrapping ai-dev-methodologies into: $TARGET"
echo "    Bundle: $BUNDLE_ROOT"
[[ "$FORCE" -eq 1 ]] && echo "    Mode: --force (overwrite existing files)"

copy_tree_instructions
copy_defaults

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

echo ""
echo "==> Done. Next steps:"
echo "  1. Edit $TARGET/.agents/instructions/project-guidelines.md"
echo "  2. Edit $TARGET/docs/AGENT_ENV.md (verification commands, staging URL)"
echo "  3. Customize $TARGET/scripts/agent-verify.sh (VERIFY_L0 / VERIFY_L1)"
echo "  4. Commit and push"
