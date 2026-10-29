#!/usr/bin/env bash
# Install the whole AI Video Production ecosystem into one workspace directory, driven by
# ../ecosystem.json (the single list of repositories). Normally reached through ../install.sh;
# running it directly from an OS checkout works the same.
#
# Usage:
#   ./scripts/bootstrap.sh [--dir DIR] [--with-optional] [--no-update] [--no-claude-skills] [--dry-run]
#
#   --dir DIR            workspace (default: $AVOS_HOME or ~/ai-video-os)
#   --with-optional      also install components marked "optional" (DVD/Blu-ray authoring)
#   --no-update          do not `git pull` repositories that are already cloned
#   --no-claude-skills   do not link Skills into ~/.claude/skills
#   --dry-run            print what would be done, change nothing
#
# What it does, per repository in ecosystem.json (except "planned" ones, which have no
# repository yet and are only reported):
#   1. Clone it under DIR, or fast-forward an existing clone to the latest origin (a clone
#      with local changes or diverged history is left alone and reported, never reset).
#   2. install=pip: `pip install -e` into DIR/.venv (or the already-active virtualenv).
#      A repository that has no pyproject.toml yet is reported as "no package yet", not failed.
#      install=npm: `npm ci` in the checkout (needs Node.js; reported if missing).
#      install=checkout: nothing to install; the agent runs it from the checkout.
#      "path": the package lives in that subdirectory of the repository.
#   3. If it has a SKILL.md, symlink it to ~/.claude/skills/<name from SKILL.md> so Claude Code
#      sees it. An existing entry there that points somewhere else is reported, never replaced.
# Then checks ffmpeg/ffprobe and Blender (never installs system packages) and runs `video-agent doctor`
# from the agent checkout, whose sibling-directory discovery finds every Skill in DIR.
#
# Safe to interrupt and re-run: nothing is deleted, no remote is changed, nothing is forced.
set -euo pipefail

OS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$OS_ROOT/ecosystem.json"
WORKSPACE="${AVOS_HOME:-$HOME/ai-video-os}"
UPDATE=1
LINK_SKILLS=1
DRY_RUN=0
WITH_OPTIONAL=0
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) WORKSPACE="${2:?--dir needs a directory}"; shift 2 ;;
    --dir=*) WORKSPACE="${1#--dir=}"; shift ;;
    --no-update) UPDATE=0; shift ;;
    --no-claude-skills) LINK_SKILLS=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --with-optional) WITH_OPTIONAL=1; shift ;;
    -h|--help) sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

for cmd in git python3; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "!! $cmd is required but not on PATH" >&2; exit 1; }
done
[ -f "$MANIFEST" ] || { echo "!! manifest not found: $MANIFEST" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" = 1 ]; then echo "   [dry-run] $*"; else "$@"; fi
}

# One line per component: repo<TAB>install<TAB>extras(comma-separated)<TAB>package subdirectory,
# "-" for an empty field (read collapses empty tab-separated fields). "planned" components
# (no repository yet) are not installed; they are listed on stderr and reported at the end.
TMP_PLANNED="$(mktemp)"
trap 'rm -f "$TMP_PLANNED"' EXIT
COMPONENTS="$(python3 - "$MANIFEST" "$WITH_OPTIONAL" 2>"$TMP_PLANNED" <<'EOF'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
for c in m["components"]:
    if c.get("status") == "planned":
        print("planned: " + c["repo"], file=sys.stderr)
        continue
    if c.get("optional") and sys.argv[2] != "1":
        continue
    print("\t".join([c["repo"], c["install"], ",".join(c.get("extras", [])) or "-", c.get("path") or "-"]))
EOF
)" || { cat "$TMP_PLANNED" >&2; echo "!! could not read $MANIFEST" >&2; exit 1; }
ORG="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["org"])' "$MANIFEST")"

if [ "$DRY_RUN" = 0 ]; then mkdir -p "$WORKSPACE"; WORKSPACE="$(cd "$WORKSPACE" && pwd)"; fi
echo "==> Workspace: $WORKSPACE"

declare -a SUMMARY=()
note() { SUMMARY+=("$1"); }
while read -r _ planned; do
  [ -n "$planned" ] && note "$planned: planned, repository not created yet"
done < "$TMP_PLANNED"

echo "--- 1. Repositories ---"
while IFS=$'\t' read -r repo _ _; do
  dir="$WORKSPACE/$repo"
  if [ -d "$dir/.git" ]; then
    if [ "$UPDATE" = 0 ]; then
      echo "   $repo: present (not updated, --no-update)"
    elif [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
      echo "!! $repo: local changes, not updated"; note "$repo: local changes, left as is"
    elif run git -C "$dir" pull --ff-only -q; then
      echo "   $repo: up to date ($(git -C "$dir" log -1 --format='%h %ad' --date=short 2>/dev/null))"
    else
      echo "!! $repo: could not fast-forward (diverged or offline), left as is"; note "$repo: not updated"
    fi
  else
    echo "   $repo: cloning"
    run git clone -q "https://github.com/$ORG/$repo" "$dir" || { echo "!! $repo: clone failed"; note "$repo: clone failed"; }
  fi
done <<< "$COMPONENTS"

echo "--- 2. Python environment ---"
if [ -n "${VIRTUAL_ENV:-}" ]; then
  PY="$VIRTUAL_ENV/bin/python"
  echo "   using the active virtualenv: $VIRTUAL_ENV"
else
  VENV="$WORKSPACE/.venv"
  [ -x "$VENV/bin/python" ] || run python3 -m venv "$VENV"
  PY="$VENV/bin/python"
  echo "   virtualenv: $VENV"
fi
run "$PY" -m pip install -q --upgrade pip || true

echo "--- 3. Packages ---"
while IFS=$'\t' read -r repo install extras sub; do
  dir="$WORKSPACE/$repo"
  [ "$sub" = "-" ] || dir="$dir/$sub"
  [ "$DRY_RUN" = 1 ] || [ -d "$dir" ] || continue
  case "$install" in
    pip)
      if [ "$DRY_RUN" = 0 ] && [ ! -f "$dir/pyproject.toml" ]; then
        echo "   $repo: no package yet (no pyproject.toml), cloned only"; note "$repo: no package yet"
        continue
      fi
      target="$dir"; [ "$extras" = "-" ] || target="${dir}[$extras]"
      echo "   $repo: pip install -e"
      run "$PY" -m pip install -q -e "$target" || { echo "!! $repo: install failed"; note "$repo: pip install failed"; }
      ;;
    npm)
      if ! command -v npm >/dev/null 2>&1; then
        echo "!! $repo: npm not found (install Node.js), not installed"; note "$repo: needs Node.js/npm"
        continue
      fi
      echo "   $repo: npm ci"
      if [ "$DRY_RUN" = 1 ] || [ -f "$dir/package-lock.json" ]; then
        run npm --prefix "$dir" ci --no-audit --no-fund --loglevel=error || { echo "!! $repo: npm ci failed"; note "$repo: npm install failed"; }
      else
        run npm --prefix "$dir" install --no-audit --no-fund --loglevel=error || { echo "!! $repo: npm install failed"; note "$repo: npm install failed"; }
      fi
      ;;
    checkout) echo "   $repo: checkout only (run from the checkout)" ;;
    *) echo "!! $repo: unknown install kind '$install' in ecosystem.json"; note "$repo: unknown install kind" ;;
  esac
done <<< "$COMPONENTS"

echo "--- 4. Claude Code skills ($CLAUDE_SKILLS_DIR) ---"
if [ "$LINK_SKILLS" = 0 ]; then
  echo "   skipped (--no-claude-skills)"
else
  run mkdir -p "$CLAUDE_SKILLS_DIR"
  while IFS=$'\t' read -r repo _ _; do
    dir="$WORKSPACE/$repo"
    [ -f "$dir/SKILL.md" ] || continue
    name="$(sed -n 's/^name:[[:space:]]*//p' "$dir/SKILL.md" | head -1 | tr -d "\"'\r")"
    name="${name:-$repo}"
    link="$CLAUDE_SKILLS_DIR/$name"
    if [ -L "$link" ] && [ "$(readlink "$link")" = "$dir" ]; then
      echo "   $name: linked"
    elif [ -e "$link" ] || [ -L "$link" ]; then
      echo "!! $name: $link already exists and is not this checkout, left as is"; note "$name: ~/.claude/skills entry not replaced"
    else
      run ln -s "$dir" "$link" && echo "   $name: linked -> $dir"
    fi
  done <<< "$COMPONENTS"
fi

echo "--- 5. ffmpeg / ffprobe / blender ---"
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "   OK: $(ffmpeg -version | head -1)"
else
  echo "!! ffmpeg/ffprobe not found. Install them yourself, e.g.:"
  echo "     Debian/Ubuntu:  sudo apt-get update && sudo apt-get install -y ffmpeg fonts-dejavu-core"
  echo "     macOS:          brew install ffmpeg"
  note "ffmpeg/ffprobe missing"
fi

if [ -d "$WORKSPACE/blender-skill" ] && ! command -v blender >/dev/null 2>&1; then
  echo "!! blender not found: blender-skill needs it (https://www.blender.org/download/, or: brew install --cask blender)"
  note "blender missing (blender-skill)"
fi

echo "--- 6. video-agent doctor ---"
AGENT_DIR="$WORKSPACE/video-production-agent"
if [ "$DRY_RUN" = 1 ]; then
  echo "   [dry-run] (cd $AGENT_DIR && $PY -m video_agent.cli doctor)"
elif [ -d "$AGENT_DIR" ]; then
  (cd "$AGENT_DIR" && "$PY" -m video_agent.cli doctor) || note "video-agent doctor reported problems (see above)"
fi

echo
if [ ${#SUMMARY[@]} -eq 0 ]; then
  echo "==> Done. Everything in ecosystem.json is installed."
else
  echo "==> Done, with notes:"
  printf '   - %s\n' "${SUMMARY[@]}"
fi
[ -n "${VIRTUAL_ENV:-}" ] || echo "    Use it: source \"$WORKSPACE/.venv/bin/activate\" && video-agent doctor"
