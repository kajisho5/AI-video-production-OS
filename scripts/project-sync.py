#!/usr/bin/env python3
"""Add the issues and pull requests of every ecosystem repository to the GitHub Project, from one place.

The repositories come from ecosystem.json (all but `planned`), plus this repository. For each one, the
issues and pull requests updated in the last DAYS days are added to the project. Adding an item that is
already there changes nothing, so runs can overlap and repeat. Standard library only.

The token (PROJECT_TOKEN) needs the classic `project` scope, plus `repo` if any repository is private.
GITHUB_TOKEN cannot write to a user's project, so the workflow uses its own secret.

Usage:
  PROJECT_TOKEN=... python3 scripts/project-sync.py [--days 2] [--owner kajisho5] [--project 1] [--report FILE]
  python3 scripts/project-sync.py --dry-run       # list what would be added; no project access needed
Exit codes: 0 done (or no token: skipped with a notice), 1 the project or a repository could not be read.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.github.com"
PAGE = 100

Rest = Callable[[str], Any]
GraphQL = Callable[[str, Dict[str, Any]], Dict[str, Any]]


def headers(token: Optional[str]) -> Dict[str, str]:
    return {"Accept": "application/vnd.github+json", "User-Agent": "ai-video-os-project-sync",
            "X-GitHub-Api-Version": "2022-11-28", **({"Authorization": f"Bearer {token}"} if token else {})}


def rest(token: Optional[str]) -> Rest:
    def get(path: str) -> Any:
        req = urllib.request.Request(API + path, headers=headers(token))
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
    return get


def graphql(token: str) -> GraphQL:
    def call(query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        req = urllib.request.Request(API + "/graphql", method="POST", headers=headers(token),
                                     data=json.dumps({"query": query, "variables": variables}).encode())
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read())
        if out.get("errors"):
            raise RuntimeError("; ".join(e.get("message", str(e)) for e in out["errors"]))
        return out["data"]
    return call


def targets(manifest: Dict[str, Any], self_repo: Optional[str]) -> List[str]:
    org = manifest["org"]
    out = [f"{org}/{c['repo']}" for c in manifest["components"] if c.get("status") != "planned"]
    if self_repo and self_repo not in out:
        out.insert(0, self_repo)
    return out


def recent_items(get: Rest, repo: str, since: str) -> List[Dict[str, Any]]:
    """Issues and pull requests (the issues endpoint returns both) updated since `since`, oldest first."""
    items: List[Dict[str, Any]] = []
    page = 1
    while True:
        batch = get(f"/repos/{repo}/issues?state=all&since={since}&sort=updated&direction=asc&per_page={PAGE}&page={page}")
        if batch is None:
            raise LookupError(f"{repo}: not found or not readable with this token")
        for it in batch:
            items.append({"node_id": it["node_id"], "number": it["number"], "title": it["title"],
                          "kind": "PR" if "pull_request" in it else "issue"})
        if len(batch) < PAGE:
            return items
        page += 1


PROJECT_Q = """query($login: String!, $number: Int!) {
  user(login: $login) { projectV2(number: $number) { id title } }
}"""
ORG_PROJECT_Q = """query($login: String!, $number: Int!) {
  organization(login: $login) { projectV2(number: $number) { id title } }
}"""
ADD_M = """mutation($project: ID!, $content: ID!) {
  addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } }
}"""


def project_id(gql: GraphQL, owner: str, number: int) -> Tuple[str, str]:
    errors = []
    for query, key in ((PROJECT_Q, "user"), (ORG_PROJECT_Q, "organization")):
        try:
            node = (gql(query, {"login": owner, "number": number}).get(key) or {}).get("projectV2")
        except RuntimeError as e:
            errors.append(str(e))
            continue
        if node:
            return node["id"], node["title"]
    raise LookupError(f"project {owner}#{number} not found or not readable with this token"
                      + (f" ({'; '.join(errors)})" if errors else ""))


def run(get: Rest, gql: Optional[GraphQL], repos: List[str], since: str, owner: str, number: int) -> Tuple[List[str], int]:
    lines: List[str] = []
    failed = 0
    pid = None
    if gql is not None:
        try:
            pid, title = project_id(gql, owner, number)
        except (LookupError, RuntimeError, urllib.error.URLError) as e:
            return [f"- project: {e}"], 1
        lines.append(f"Project **{title}** ({owner}#{number}), items updated since {since}:")
    else:
        lines.append(f"Dry run: items updated since {since} that would be added to {owner}#{number}:")
    total = 0
    for repo in repos:
        try:
            items = recent_items(get, repo, since)
        except (LookupError, urllib.error.URLError) as e:
            lines.append(f"- {repo}: {e}")
            failed = 1
            continue
        for it in items:
            if pid is not None:
                try:
                    gql(ADD_M, {"project": pid, "content": it["node_id"]})
                except (RuntimeError, urllib.error.URLError) as e:
                    lines.append(f"- {repo}#{it['number']}: not added ({e})")
                    failed = 1
                    continue
            total += 1
        if items:
            shown = ", ".join("%s #%d" % (i["kind"], i["number"]) for i in items[:10])
            lines.append(f"- {repo}: {len(items)} ({shown}" + (", ..." if len(items) > 10 else "") + ")")
    lines.append(f"{total} item(s) {'in the project' if pid else 'found'}.")
    return lines, failed


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=float, default=2, help="look back this many days (default 2)")
    ap.add_argument("--owner", help="project owner (default: ecosystem.json org)")
    ap.add_argument("--project", type=int, default=1, help="project number (default 1)")
    ap.add_argument("--dry-run", action="store_true", help="only list the items; no project access")
    ap.add_argument("--report", help="also write the report to this file (Markdown)")
    args = ap.parse_args(argv)

    manifest = json.loads((ROOT / "ecosystem.json").read_text(encoding="utf-8"))
    owner = args.owner or manifest["org"]
    repos = targets(manifest, os.environ.get("GITHUB_REPOSITORY"))
    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    token = os.environ.get("PROJECT_TOKEN")
    if not args.dry_run and not token:
        msg = "PROJECT_TOKEN is not set: skipped. Add it as a repository secret (see README, Tracking in the GitHub Project)."
        print(f"::notice::{msg}" if os.environ.get("GITHUB_ACTIONS") else msg)
        if args.report:
            Path(args.report).write_text(msg + "\n", encoding="utf-8")
        return 0
    lines, failed = run(rest(token or os.environ.get("GITHUB_TOKEN")), None if args.dry_run else graphql(token),
                        repos, since, owner, args.project)
    text = "\n".join(lines) + "\n"
    print(text, end="")
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    return failed


if __name__ == "__main__":
    sys.exit(main())
