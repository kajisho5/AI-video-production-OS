#!/usr/bin/env bash
# One-command install of the Velisa ecosystem: the OS, the agent and every Skill
# listed in ecosystem.json.
#
#   curl -fsSL https://raw.githubusercontent.com/kajisho5/Velisa/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --dir ~/work/avos --no-claude-skills
#
# Re-running it updates everything to the latest. Options are those of scripts/bootstrap.sh.
set -euo pipefail

REPO_URL="https://github.com/kajisho5/Velisa"
# Workspace: $VELISA_HOME; else $AVOS_HOME (its name before the rename to Velisa); else ~/velisa-workspace,
# unless only the pre-rename default ~/ai-video-os exists -- then that one, so an existing install keeps
# being updated in place (docs/RENAMING.md, ADR-015). scripts/bootstrap.sh resolves it the same way.
if [ -n "${VELISA_HOME:-}" ]; then
  WORKSPACE="$VELISA_HOME"
elif [ -n "${AVOS_HOME:-}" ]; then
  WORKSPACE="$AVOS_HOME"
elif [ ! -e "$HOME/velisa-workspace" ] && [ -d "$HOME/ai-video-os" ]; then
  WORKSPACE="$HOME/ai-video-os"
else
  WORKSPACE="$HOME/velisa-workspace"
fi
args=("$@")
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) WORKSPACE="${2:?--dir needs a directory}"; shift 2 ;;
    --dir=*) WORKSPACE="${1#--dir=}"; shift ;;
    *) shift ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "!! git is required but not on PATH" >&2; exit 1; }

# Run from a checkout (./install.sh): use that checkout. Piped from curl: clone/update the OS
# into the workspace and use that.
here=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/ecosystem.json" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -z "$here" ]; then
  mkdir -p "$WORKSPACE"
  here="$WORKSPACE/Velisa"
  # Workspaces made before the rename have the checkout under the old name: keep using it.
  if [ ! -d "$here/.git" ] && [ -d "$WORKSPACE/AI-video-production-OS/.git" ]; then
    here="$WORKSPACE/AI-video-production-OS"
  fi
  if [ -d "$here/.git" ]; then
    git -C "$here" pull --ff-only -q || echo "!! Velisa: could not fast-forward, using it as is"
  else
    git clone -q "$REPO_URL" "$here"
  fi
fi

# ${args[@]+...}: an empty array under `set -u` is an error in macOS's bash 3.2.
exec bash "$here/scripts/bootstrap.sh" ${args[@]+"${args[@]}"}
