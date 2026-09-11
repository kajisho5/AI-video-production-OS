#!/usr/bin/env bash
# Decide whether this push should cut a release, and if so, bump every version-bearing
# file, prepend the CHANGELOG.md entry, and create a local commit + annotated tag.
#
# This script never pushes anything itself (the caller does `git push origin main
# --follow-tags` once this script exits 0) and never talks to the GitHub API (the caller
# creates the GitHub Release / runs `npm publish` afterwards, using this script's
# outputs). That split keeps this script runnable and testable outside of Actions.
#
# Inputs (environment variables):
#   DRAFTER_RESOLVED_VERSION  the "vX.Y.Z" (or "X.Y.Z") version release-drafter's
#                             dry-run resolved from labels on PRs merged since the last
#                             tag. Required.
#   DRAFTER_BODY              the markdown changelog body release-drafter's dry-run
#                             produced for those same PRs. Required (may be empty text,
#                             but the variable must be set).
#   VERSION_FILE              path to the single-source-of-truth version file.
#                             Default: VERSION
#   CHANGELOG_FILE            path to the changelog to prepend to. Default: CHANGELOG.md
#   PACKAGE_DIRS              space-separated directories containing a package.json
#                             whose "version" field should be kept in lockstep with
#                             VERSION_FILE. Default: empty (none).
#
# Outputs: written as `key=value` lines to $GITHUB_OUTPUT if that variable is set
# (i.e. running inside a real Actions step); always also printed to stdout so this
# script is inspectable when run by hand or from a test fixture.
#   should_release   true | false
#   version          X.Y.Z (only meaningful when should_release=true)
#   tag              vX.Y.Z (only meaningful when should_release=true)
#
# Version selection rule: if VERSION_FILE's current content already differs from the
# latest "vX.Y.Z" git tag, a human (or an earlier, separate commit) already bumped it
# ahead of the last release on purpose -- that value is respected as-is and never
# overwritten by DRAFTER_RESOLVED_VERSION. Only when VERSION_FILE still matches the
# latest tag (nothing bumped it since the last release) does this script compute the
# next version from DRAFTER_RESOLVED_VERSION. Either way, if a tag for the resulting
# target version already exists, there is nothing new to release (should_release=false)
# -- this is what keeps a second push with no new merged-PR activity from re-releasing.
set -euo pipefail

VERSION_FILE="${VERSION_FILE:-VERSION}"
CHANGELOG_FILE="${CHANGELOG_FILE:-CHANGELOG.md}"
PACKAGE_DIRS="${PACKAGE_DIRS:-}"

: "${DRAFTER_RESOLVED_VERSION:?DRAFTER_RESOLVED_VERSION must be set}"
: "${DRAFTER_BODY+x}" # allow empty, but require the variable to be set (see usage note above)

emit() {
  # $1=key $2=value -- never interpolate untrusted content through this (both args here
  # are always our own computed values, never raw PR titles/bodies).
  echo "$1=$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >>"$GITHUB_OUTPUT"
  fi
}

resolved_version="${DRAFTER_RESOLVED_VERSION#v}"

latest_tag="$(git tag --list 'v*' --sort=-v:refname | head -n1 || true)"
latest_tag_version="${latest_tag#v}"

current_version=""
if [ -f "$VERSION_FILE" ]; then
  current_version="$(tr -d '[:space:]' <"$VERSION_FILE")"
fi

if [ -n "$current_version" ] && [ "$current_version" != "$latest_tag_version" ]; then
  echo "VERSION_FILE ($current_version) already differs from the latest tag (${latest_tag_version:-none}); respecting the manual bump." >&2
  target_version="$current_version"
else
  echo "VERSION_FILE matches the latest tag (${latest_tag_version:-none}); auto-bumping to release-drafter's resolved version." >&2
  target_version="$resolved_version"
fi

target_tag="v$target_version"

if git rev-parse -q --verify "refs/tags/$target_tag" >/dev/null 2>&1; then
  echo "Tag $target_tag already exists; nothing new to release." >&2
  emit should_release false
  exit 0
fi

echo "$target_version" >"$VERSION_FILE"

for dir in $PACKAGE_DIRS; do
  if [ -f "$dir/package.json" ]; then
    (cd "$dir" && npm pkg set version="$target_version" >/dev/null)
  fi
done

today="$(date -u +%Y-%m-%d)"
release_notes_file="${RELEASE_NOTES_FILE:-release_notes.md}"

# This version's own section, written once and reused both as the CHANGELOG.md entry
# and (by the caller, via `body_path:`, never `${{ }}`) as the GitHub Release body --
# DRAFTER_BODY only ever reaches disk through this `printf ... > file` redirect, never
# spliced into a `${{ }}` template inside a run: block or an eval'd string. That is the
# mitigation for GitHub Actions' documented script-injection risk from untrusted PR
# titles/bodies flowing into release-drafter's output.
{
  echo "## $target_tag ($today)"
  echo
  printf '%s\n' "$DRAFTER_BODY"
} >"$release_notes_file"

tmp_changelog="$(mktemp)"
{
  cat "$release_notes_file"
  echo
  if [ -f "$CHANGELOG_FILE" ]; then
    cat "$CHANGELOG_FILE"
  fi
} >"$tmp_changelog"
mv "$tmp_changelog" "$CHANGELOG_FILE"

git add "$VERSION_FILE" "$CHANGELOG_FILE"
for dir in $PACKAGE_DIRS; do
  [ -f "$dir/package.json" ] && git add "$dir/package.json"
done

git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -m "chore(release): $target_tag"
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  tag -a "$target_tag" -m "$target_tag"

emit should_release true
emit version "$target_version"
emit tag "$target_tag"
