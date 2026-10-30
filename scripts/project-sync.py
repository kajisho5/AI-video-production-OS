#!/usr/bin/env python3
"""Add the issues and pull requests of every ecosystem repository to the GitHub Project, from one place.

The repositories come from ecosystem.json (all but `planned`), plus this repository. For each one, the
issues and pull requests updated in the last DAYS days are added to the project, unless they are already
in it (the project's items are read first). Standard library only.

GitHub limits how fast content can be written, so additions are paced (--pause), a rate-limit answer is
waited out, and the run stops at a time budget (--budget-minutes) or after repeated rate limits. Whatever
is left is added by the next run, so a large backfill completes over several runs.

The token (PROJECT_TOKEN) needs the classic `project` scope, plus `repo` if any repository is private.
GITHUB_TOKEN cannot write to a user's project, so the workflow uses its own secret.

Usage:
  PROJECT_TOKEN=... python3 scripts/project-sync.py [--days 2] [--owner kajisho5] [--project 1] [--report FILE]
  python3 scripts/project-sync.py --dry-run       # list what would be added; no project access needed
Exit codes: 0 done, stopped at the budget or rate limit (the next run continues), or no token (skipped
with a notice); 1 the project or a repository could not be read, or an item was refused.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.github.com"
PAGE = 100
MAX_RATE_LIMITS = 3  # rate-limit answers in a row before the run stops and leaves the rest to the next run

Rest = Callable[[str], Any]
GraphQL = Callable[[str, Dict[str, Any]], Dict[str, Any]]


class RateLimited(Exception):
    def __init__(self, wait: float):
        super().__init__(f"rate limited, retry after {wait:.0f}s")
        self.wait = wait


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
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                out = json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                raise RateLimited(float(e.headers.get("Retry-After") or 60)) from e
            raise
        if out.get("errors"):
            msg = "; ".join(e.get("message", str(e)) for e in out["errors"])
            if any(e.get("type") == "RATE_LIMITED" for e in out["errors"]) or "rate limit" in msg.lower():
                raise RateLimited(60)
            raise RuntimeError(msg)
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
ITEMS_Q = """query($id: ID!, $after: String) {
  node(id: $id) { ... on ProjectV2 { items(first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { content { ... on Issue { id } ... on PullRequest { id } } }
  } } }
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


def project_contents(gql: GraphQL, pid: str) -> Set[str]:
    """Node ids of the issues and pull requests already in the project (reads only)."""
    seen: Set[str] = set()
    after = None
    while True:
        items = gql(ITEMS_Q, {"id": pid, "after": after})["node"]["items"]
        seen.update(n["content"]["id"] for n in items["nodes"] if n.get("content") and n["content"].get("id"))
        if not items["pageInfo"]["hasNextPage"]:
            return seen
        after = items["pageInfo"]["endCursor"]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def run(get: Rest, gql: Optional[GraphQL], repos: List[str], since: str, owner: str, number: int, *,
        pause: float = 1.0, budget: float = 50 * 60, sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic) -> Tuple[List[str], int]:
    lines: List[str] = []
    failed = 0
    pid = None
    existing: Set[str] = set()
    if gql is not None:
        try:
            pid, title = project_id(gql, owner, number)
            existing = project_contents(gql, pid)
        except (LookupError, RuntimeError, RateLimited, urllib.error.URLError) as e:
            return [f"- project: {e}"], 1
        lines.append(f"Project **{title}** ({owner}#{number}): {len(existing)} item(s) already in it. "
                     f"Items updated since {since}:")
    else:
        lines.append(f"Dry run: items updated since {since} that would be added to {owner}#{number}:")
    start = clock()
    added = present = pending = found = 0
    limited_in_a_row = 0
    stopped: Optional[str] = None
    for repo in repos:
        try:
            items = recent_items(get, repo, since)
        except (LookupError, urllib.error.URLError) as e:
            lines.append(f"- {repo}: {e}")
            failed = 1
            continue
        new = [it for it in items if it["node_id"] not in existing]
        present += len(items) - len(new)
        done = []
        for it in new:
            if pid is None:
                done.append(it)
                found += 1
                continue
            if stopped:
                pending += 1
                continue
            while True:
                if clock() - start > budget:
                    stopped = f"time budget ({budget / 60:.0f} min) reached"
                    break
                try:
                    gql(ADD_M, {"project": pid, "content": it["node_id"]})
                    limited_in_a_row = 0
                    break
                except RateLimited as e:
                    limited_in_a_row += 1
                    if limited_in_a_row >= MAX_RATE_LIMITS:
                        stopped = f"rate limited {MAX_RATE_LIMITS} times in a row"
                        break
                    log(f"{repo}#{it['number']}: {e}; waiting")
                    sleep(e.wait)
                except (RuntimeError, urllib.error.URLError) as e:
                    lines.append(f"- {repo}#{it['number']}: not added ({e})")
                    failed = 1
                    it = None
                    break
            if stopped:
                pending += 1
                continue
            if it is not None:
                done.append(it)
                added += 1
                sleep(pause)
        if done:
            shown = ", ".join("%s #%d" % (i["kind"], i["number"]) for i in done[:10])
            lines.append(f"- {repo}: {len(done)} ({shown}" + (", ..." if len(done) > 10 else "") + ")")
            log(f"{repo}: {len(done)} {'added' if pid else 'found'}")
    if pid is None:
        lines.append(f"{found} item(s) found.")
    else:
        lines.append(f"Added {added}; {present} already in the project.")
        if stopped:
            lines.append(f"Stopped: {stopped}. {pending} item(s) left for the next run.")
    return lines, failed


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=float, default=2, help="look back this many days (default 2)")
    ap.add_argument("--owner", help="project owner (default: ecosystem.json org)")
    ap.add_argument("--project", type=int, default=1, help="project number (default 1)")
    ap.add_argument("--pause", type=float, default=1.0, help="seconds between additions (default 1)")
    ap.add_argument("--budget-minutes", type=float, default=50, help="stop adding after this long (default 50)")
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
                        repos, since, owner, args.project, pause=args.pause, budget=args.budget_minutes * 60)
    text = "\n".join(lines) + "\n"
    print(text, end="")
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    return failed


if __name__ == "__main__":
    sys.exit(main())
