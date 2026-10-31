#!/usr/bin/env bash
# Audit every repository in ecosystem.json with System Intelligence (`si watch`, read-only):
# each run records a snapshot per repository under STATE_DIR and reports what changed since
# the previous run (the first run only records a baseline). Writes a Markdown summary.
#
# Repositories are cloned (or fast-forwarded) into CLONE_DIR with plain git and audited as local
# paths, so a failed clone is reported as such rather than inside si's own output.
#
# Usage: scripts/ecosystem-audit.sh [STATE_DIR] [SUMMARY_FILE] [CLONE_DIR]
#   defaults: .si-state  ecosystem-audit.md  .si-repos
#   needs `si` on PATH: pip install git+https://github.com/kajisho5/system-intelligence
set -euo pipefail

OS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${1:-.si-state}"
SUMMARY="${2:-ecosystem-audit.md}"
CLONE_DIR="${3:-.si-repos}"
mkdir -p "$CLONE_DIR"
command -v si >/dev/null 2>&1 || { echo "!! si not on PATH" >&2; exit 1; }
# si refuses improve/execute/propose/verify under this flag (system-intelligence ADR-013).
export SI_READ_ONLY=1

REPOS="$(python3 - "$OS_ROOT/ecosystem.json" <<'EOF'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
for c in m["components"]:
    if c.get("status") != "planned":
        print(m["org"] + "/" + c["repo"])
EOF
)"

{
  echo "# Ecosystem audit ($(date -u +%Y-%m-%d))"
  echo
  echo "System Intelligence \`si watch\` per repository (read-only). First run per repository records a baseline."
  echo
} > "$SUMMARY"

failed=0
while read -r target; do
  name="${target#*/}"
  log="$(mktemp)"
  dir="$CLONE_DIR/$name"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" pull -q --ff-only > "$log" 2>&1 || true
  elif ! git clone -q --depth 1 "https://github.com/$target" "$dir" > "$log" 2>&1; then
    status="clone failed"; failed=$((failed + 1))
    { echo "- **$name** — $status: \`$(tail -n 1 "$log")\`"; echo; } >> "$SUMMARY"
    echo "   $name: $status"; rm -f "$log"; continue
  fi
  if si watch "$dir" --state-dir "$STATE_DIR/$name" > "$log" 2>&1; then
    status="ok"
  else
    status="si failed"; failed=$((failed + 1))
  fi
  {
    echo "<details><summary><b>$name</b> — $status</summary>"
    echo
    echo '```'
    tail -n 40 "$log"
    echo '```'
    echo "</details>"
    echo
  } >> "$SUMMARY"
  echo "   $name: $status"
  rm -f "$log"
done <<< "$REPOS"

echo "==> Summary: $SUMMARY ($failed repositories could not be audited)"
