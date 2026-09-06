#!/usr/bin/env bash
# Bootstrap the AI Video Production OS ecosystem on a fresh machine: clone every real
# repository as a sibling directory, install what needs installing, and run a real
# `video-agent doctor` so the user sees exactly what is (and isn't) usable — no guessing.
#
# Why this exists: today there is no single install path for this ecosystem (README.md's
# own "Quick start" says so). A user has to know 11 repository URLs, know which are npm and
# which are pip, know that `video-production-agent`'s own Skill-discovery mechanism looks for
# sibling directories named exactly `<skill-name>` next to itself, and wire that up by hand.
# This script does that once, so the *next* time is `git pull` in 11 directories, not this.
#
# Usage:
#   ./scripts/bootstrap.sh [target-directory]     # default: ./ai-video-os-workspace
#
# What it does:
#   1. Clones video-production-agent + all 10 Skill repositories as siblings under the
#      target directory (skips any that already exist — safe to re-run).
#   2. `pip install -e .` for video-production-agent and each of the 9 Python Skills, so
#      their own third-party dependencies (Pillow, numpy, faster-whisper, ...) are present.
#      ffmpeg-skill is left as a checkout only: video-production-agent's ffmpeg-skill
#      adapter runs it straight from `<checkout>/scripts/*.py` with no install needed.
#   3. Checks `ffmpeg`/`ffprobe` are on PATH and prints an install hint if not (never
#      installs system packages itself — that needs root/sudo the user should grant knowingly).
#   4. Runs `video-agent doctor` from inside the video-production-agent checkout, so its own
#      sibling-directory discovery (`../<skill-name>`) finds every Skill with **no environment
#      variables at all** — the real, lowest-friction path this ecosystem's own code already
#      supports but nothing had scripted until now.
#
# Never touches git remotes, never force-pushes, never deletes anything; every step is
# additive and safe to interrupt and re-run.
set -euo pipefail

TARGET="${1:-./ai-video-os-workspace}"
ORG="kajisho5"
PY_SKILLS=(media-analysis-skill transcription-skill video-editing-skill audio-production-skill subtitle-skill thumbnail-skill color-grading-skill motion-graphics-skill qc-skill)
NODE_SKILLS=(ffmpeg-skill)
AGENT_REPO="video-production-agent"

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
echo "==> Ecosystem workspace: $TARGET"

clone_if_missing() {
  local repo="$1" dir="$TARGET/$1"
  if [ -d "$dir/.git" ]; then
    echo "==> $repo already cloned, skipping (run 'git pull' inside it yourself to update)"
  else
    echo "==> Cloning $repo"
    git clone --depth 1 "https://github.com/$ORG/$repo" "$dir"
  fi
}

echo "--- 1. Cloning repositories ---"
clone_if_missing "$AGENT_REPO"
for repo in "${PY_SKILLS[@]}" "${NODE_SKILLS[@]}"; do
  clone_if_missing "$repo"
done

echo "--- 2. Installing Python packages (agent + Python Skills) ---"
PY="${PYTHON:-python3}"
"$PY" -m pip install -e "$TARGET/$AGENT_REPO" || echo "!! video-production-agent install failed — see output above; video-agent CLI will not be on PATH"
for repo in "${PY_SKILLS[@]}"; do
  echo "-- $repo"
  "$PY" -m pip install -e "$TARGET/$repo" || echo "!! $repo install failed (non-fatal — video-production-agent can still run it from the checkout via sibling-directory discovery, but the Skill's own third-party dependencies may be missing)"
done
echo "-- ffmpeg-skill: left as a checkout only (video-production-agent runs its scripts/*.py directly, no install needed; 'npm install -g ffmpeg-skill' also works if you want its own CLI)"

echo "--- 3. Checking ffmpeg/ffprobe ---"
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "OK: $(ffmpeg -version | head -1)"
else
  echo "!! ffmpeg/ffprobe not found on PATH. Install them yourself, e.g.:"
  echo "     Debian/Ubuntu:  sudo apt-get update && sudo apt-get install -y ffmpeg fonts-dejavu-core"
  echo "     macOS:          brew install ffmpeg"
fi

echo "--- 4. Real environment check (video-agent doctor) ---"
echo "    Running from inside $AGENT_REPO's checkout so its own sibling-directory Skill"
echo "    discovery (../<skill-name>) finds every Skill cloned above with no env vars."
(
  cd "$TARGET/$AGENT_REPO"
  if command -v video-agent >/dev/null 2>&1; then
    video-agent doctor || true
  else
    "$PY" -m video_agent.cli doctor || true
  fi
)

echo "==> Done. Re-run this script anytime to pick up new Skill repositories or repair a missing install."
