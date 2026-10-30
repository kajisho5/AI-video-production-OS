"""scripts/project-sync.py adds every ecosystem repository's recent issues and pull requests to the GitHub
Project. Offline: the REST and GraphQL calls are faked.

    python3 -m unittest discover -s scripts/tests -v
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("project_sync", ROOT / "scripts" / "project-sync.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def issue(n, pr=False):
    it = {"node_id": f"{'PR' if pr else 'I'}_{n}", "number": n, "title": f"t{n}"}
    if pr:
        it["pull_request"] = {}
    return it


class FakeREST:
    def __init__(self, data):
        self.data = data
        self.paths = []

    def __call__(self, path):
        self.paths.append(path)
        repo = path.split("/")[2] + "/" + path.split("/")[3]
        page = int(path.rsplit("page=", 1)[1])
        items = self.data.get(repo)
        if items is None:
            return None
        return items[(page - 1) * sync.PAGE: page * sync.PAGE]


class FakeGQL:
    def __init__(self, user_project=True):
        self.user_project = user_project
        self.added = []

    def __call__(self, query, variables):
        if query is sync.PROJECT_Q:
            return {"user": {"projectV2": {"id": "P1", "title": "AI Video Production Ecosystem"}} if self.user_project else None}
        if query is sync.ORG_PROJECT_Q:
            return {"organization": {"projectV2": {"id": "P9", "title": "Org"}}}
        self.added.append((variables["project"], variables["content"]))
        return {"addProjectV2ItemById": {"item": {"id": "x"}}}


class ProjectSyncTests(unittest.TestCase):
    def test_targets_are_every_non_planned_repo_plus_this_one(self):
        m = {"org": "o", "components": [{"repo": "a", "status": "active"}, {"repo": "p", "status": "planned"}]}
        self.assertEqual(sync.targets(m, "o/os"), ["o/os", "o/a"])
        self.assertEqual(sync.targets(m, "o/a"), ["o/a"])

    def test_issues_and_prs_are_added_with_their_node_ids(self):
        get = FakeREST({"o/a": [issue(1), issue(2, pr=True)], "o/b": []})
        gql = FakeGQL()
        lines, failed = sync.run(get, gql, ["o/a", "o/b"], "2026-10-28T00:00:00Z", "o", 1)
        self.assertEqual(failed, 0)
        self.assertEqual(gql.added, [("P1", "I_1"), ("P1", "PR_2")])
        self.assertIn("issue #1, PR #2", "\n".join(lines))
        self.assertIn("since=2026-10-28T00:00:00Z", get.paths[0])

    def test_pages_are_followed(self):
        get = FakeREST({"o/a": [issue(n) for n in range(sync.PAGE + 3)]})
        gql = FakeGQL()
        sync.run(get, gql, ["o/a"], "s", "o", 1)
        self.assertEqual(len(gql.added), sync.PAGE + 3)
        self.assertEqual(len(get.paths), 2)

    def test_org_project_is_found_when_owner_is_not_a_user(self):
        gql = FakeGQL(user_project=False)
        sync.run(FakeREST({"o/a": [issue(1)]}), gql, ["o/a"], "s", "o", 1)
        self.assertEqual(gql.added, [("P9", "I_1")])

    def test_unreadable_repo_fails_but_others_still_sync(self):
        gql = FakeGQL()
        lines, failed = sync.run(FakeREST({"o/b": [issue(5)]}), gql, ["o/a", "o/b"], "s", "o", 1)
        self.assertEqual(failed, 1)
        self.assertEqual(gql.added, [("P1", "I_5")])

    def test_dry_run_adds_nothing(self):
        lines, failed = sync.run(FakeREST({"o/a": [issue(1)]}), None, ["o/a"], "s", "o", 1)
        self.assertEqual(failed, 0)
        self.assertIn("Dry run", lines[0])

    def test_no_token_skips_without_failing(self):
        import os
        old = os.environ.pop("PROJECT_TOKEN", None)
        try:
            self.assertEqual(sync.main([]), 0)
        finally:
            if old is not None:
                os.environ["PROJECT_TOKEN"] = old


if __name__ == "__main__":
    unittest.main(verbosity=2)
