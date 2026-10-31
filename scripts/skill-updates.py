#!/usr/bin/env python3
"""Report which ecosystem repositories changed since the last check: new commits on the default branch and
new version tags, with the commit subjects. Standard library and git only: heads and tags come from
`git ls-remote`; the GitHub API is used for commit subjects (GITHUB_TOKEN / GH_TOKEN when set, for the rate
limit; without it, subjects may be missing) and for the issue in --issue mode.

Two ways to keep the "last check" state:
  --state FILE   a local JSON file (first run records a baseline and reports nothing)
  --issue        an open issue labelled `skill-updates` in GITHUB_REPOSITORY holds the state in its body;
                 every change is posted as a comment on it, mentioning NOTIFY (default: the repository
                 owner), so GitHub notifies by mail / app. Needs GITHUB_TOKEN with issues: write.
                 Used by .github/workflows/skill-updates.yml.

Usage:
  python3 scripts/skill-updates.py --state ~/.velisa/updates.json
  python3 scripts/skill-updates.py --issue [--report FILE]
Exit codes: 0 checked (changes or not), 1 the API could not be read for every repository.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.github.com"
LABEL = "skill-updates"
TITLE = "Skill updates"
STATE_RE = re.compile(r"<!-- skill-updates-state\n(.*?)\n-->", re.S)
MAX_SUBJECTS = 15

Fetch = Callable[[str, str, Optional[Dict[str, Any]]], Any]


def github(token: Optional[str]) -> Fetch:
    def fetch(method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Accept": "application/vnd.github+json", "User-Agent": "ai-video-os-skill-updates",
                                              "X-GitHub-Api-Version": "2022-11-28", **({"Authorization": f"Bearer {token}"} if token else {})})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
    return fetch


def repos(manifest: Dict[str, Any]) -> List[str]:
    return [c["repo"] for c in manifest["components"] if c.get("status") != "planned"]


def version_key(tag: str) -> Tuple:
    nums = re.findall(r"\d+", tag)
    return (bool(nums), [int(n) for n in nums], tag)


def ls_remote(org: str, repo: str) -> Dict[str, Any]:
    """Default-branch head and the highest version tag, read with `git ls-remote` (no API rate limit)."""
    out = subprocess.run(["git", "ls-remote", "--symref", f"https://github.com/{org}/{repo}"], capture_output=True, text=True,
                         timeout=60, env=dict(os.environ, GIT_TERMINAL_PROMPT="0"))
    if out.returncode != 0:
        raise OSError((out.stderr.strip().splitlines() or ["git ls-remote failed"])[-1])
    sha, branch, tags = None, None, []
    for line in out.stdout.splitlines():
        if line.startswith("ref: "):
            branch = line.split()[1][len("refs/heads/"):]
            continue
        h, _, ref = line.partition("\t")
        if ref == "HEAD":
            sha = h
        elif ref.startswith("refs/tags/") and not ref.endswith("^{}"):
            tags.append(ref[len("refs/tags/"):])
    if not sha:
        return {"error": "empty repository"}
    return {"branch": branch, "sha": sha, "release": max(tags, key=version_key) if tags else None}


def changes(fetch: Fetch, org: str, old: Dict[str, Dict[str, Any]], new: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for repo, now in new.items():
        before = old.get(repo)
        if not before or now.get("error") or not now.get("sha"):
            continue   # a repository seen for the first time is a baseline, not an update
        if before.get("sha") == now["sha"] and before.get("release") == now.get("release"):
            continue
        subjects: List[str] = []
        total = 0
        if before.get("sha") and before["sha"] != now["sha"]:
            try:
                cmp = fetch("GET", f"/repos/{org}/{repo}/compare/{before['sha']}...{now['sha']}", None) or {}
            except (urllib.error.URLError, OSError, ValueError):
                cmp = {}   # rate limited / offline: the update is still reported, without its commit subjects
            commits = cmp.get("commits") or []
            total = cmp.get("total_commits", len(commits))
            subjects = [c["commit"]["message"].splitlines()[0] for c in commits][-MAX_SUBJECTS:]
        out.append({"repo": repo, "from": before.get("sha"), "to": now["sha"], "commits": total, "subjects": subjects,
                    "release_from": before.get("release"), "release": now.get("release"),
                    "release_url": f"https://github.com/{org}/{repo}/releases/tag/{now['release']}" if now.get("release") else None})
    return out


def report(org: str, found: List[Dict[str, Any]], errors: List[str], notify: Optional[str] = None) -> str:
    if not found and not errors:
        return ""
    lines = [f"## {len(found)} repositor{'y' if len(found) == 1 else 'ies'} updated ({datetime.now(timezone.utc):%Y-%m-%d})" if found else "## No updates"]
    if notify:
        lines.append(f"@{notify}")
    for u in found:
        head = f"### [{u['repo']}](https://github.com/{org}/{u['repo']})"
        if u["release"] != u["release_from"] and u["release"]:
            head += f" — tag **{u['release']}**" + (f" (was {u['release_from']})" if u["release_from"] else "") + (f" [notes]({u['release_url']})" if u.get("release_url") else "")
        lines.append(head)
        if u["from"] != u["to"] and not u["commits"]:
            lines.append(f"new commits — [diff](https://github.com/{org}/{u['repo']}/compare/{(u['from'] or '')[:12]}...{u['to'][:12]})")
        if u["commits"]:
            lines.append(f"{u['commits']} new commit(s) — [diff](https://github.com/{org}/{u['repo']}/compare/{u['from'][:12]}...{u['to'][:12]})")
            lines += [f"- {s}" for s in u["subjects"]]
            if u["commits"] > len(u["subjects"]):
                lines.append(f"- … and {u['commits'] - len(u['subjects'])} earlier")
    if errors:
        lines.append("### Could not read")
        lines += [f"- {e}" for e in errors]
    lines.append("")
    lines.append("Update: Claude Code `/plugin marketplace update ai-video-production-os` (or turn on auto-update for it under `/plugin` → Marketplaces); CLIs and Python packages: re-run `./install.sh`.")
    return "\n".join(lines) + "\n"


def collect(fetch: Fetch, manifest: Dict[str, Any], old: Dict[str, Dict[str, Any]]) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    org = manifest["org"]
    new: Dict[str, Dict[str, Any]] = {}
    errors: List[str] = []
    for repo in repos(manifest):
        try:
            new[repo] = ls_remote(org, repo)
        except (urllib.error.URLError, OSError, ValueError) as e:
            errors.append(f"{repo}: {e}")
            if repo in old:
                new[repo] = old[repo]   # keep the last known state; it is compared again next time
            continue
        if new[repo].get("error"):
            errors.append(f"{repo}: {new[repo]['error']}")
    return new, changes(fetch, org, old, new), errors


def issue_body(org: str, state: Dict[str, Dict[str, Any]]) -> str:
    rows = ["| Repository | Latest tag | Head |", "|---|---|---|"]
    for repo, s in sorted(state.items()):
        rows.append(f"| [{repo}](https://github.com/{org}/{repo}) | {s.get('release') or '-'} | {(s.get('sha') or '-')[:12]} |")
    return ("Updates of every repository in ecosystem.json are posted here as comments by "
            "`.github/workflows/skill-updates.yml` (daily). Subscribe to this issue to get them by mail / in the GitHub app.\n\n"
            + "\n".join(rows) + "\n\n<!-- skill-updates-state\n" + json.dumps(state, sort_keys=True) + "\n-->\n")


def run_issue(fetch: Fetch, manifest: Dict[str, Any], repository: str, notify: Optional[str]) -> Tuple[str, int]:
    found = fetch("GET", f"/repos/{repository}/issues?labels={LABEL}&state=open&per_page=10", None) or []
    issue = next((i for i in found if "pull_request" not in i), None)
    m = STATE_RE.search(issue["body"] or "") if issue else None
    old = json.loads(m.group(1)) if m else {}
    new, updates, errors = collect(fetch, manifest, old)
    if not new:
        return report(manifest["org"], [], errors), 1
    body = issue_body(manifest["org"], new)
    if issue is None:
        issue = fetch("POST", f"/repos/{repository}/issues", {"title": TITLE, "body": body, "labels": [LABEL]})
    else:
        fetch("PATCH", f"/repos/{repository}/issues/{issue['number']}", {"body": body})
    text = report(manifest["org"], updates, errors, notify if updates else None)
    if updates:
        fetch("POST", f"/repos/{repository}/issues/{issue['number']}/comments", {"body": text})
    return text, 0


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--state", help="local state file")
    mode.add_argument("--issue", action="store_true", help="keep the state in the skill-updates issue of GITHUB_REPOSITORY")
    ap.add_argument("--report", help="also write the report (Markdown) to this file")
    a = ap.parse_args(argv)
    manifest = json.loads((ROOT / "ecosystem.json").read_text(encoding="utf-8"))
    fetch = github(os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"))
    if a.issue:
        repository = os.environ.get("GITHUB_REPOSITORY") or f"{manifest['org']}/Velisa"
        text, rc = run_issue(fetch, manifest, repository, os.environ.get("NOTIFY") or repository.split("/")[0])
    else:
        path = Path(a.state).expanduser()
        old = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
        new, updates, errors = collect(fetch, manifest, old)
        rc = 1 if not new else 0
        if new:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(new, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        text = report(manifest["org"], updates, errors) or ("baseline recorded\n" if not old else "no updates\n")
    sys.stdout.write(text or "no updates\n")
    if a.report:
        Path(a.report).write_text(text or "No updates.\n", encoding="utf-8")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
