import { describe, expect, it } from "vitest";
import { buildGraph, buildOverview, buildRepoStatus } from "../src/normalize.js";
import type { RegistryRepo } from "../src/config.js";
import type { RepoGithubFacts } from "../src/github.js";
import { UNKNOWN } from "../../shared/types.js";

function registryRepo(overrides: Partial<RegistryRepo> = {}): RegistryRepo {
  return { slug: "kajisho5/example-skill", name: "example-skill", type: "Skill", role: "test role", depends_on: [], ...overrides };
}

function githubFacts(overrides: Partial<RepoGithubFacts> = {}): RepoGithubFacts {
  return {
    exists: true,
    defaultBranch: "main",
    latestCommit: { sha: "abc123", message: "fix things", author: "kajisho5", date: "2026-09-05T00:00:00Z", url: "https://x" },
    lastUpdatedAt: "2026-09-05T00:00:00Z",
    openPullRequests: [],
    openIssues: [],
    ci: { conclusion: "success", workflowName: "tests", runUrl: "https://x", updatedAt: "2026-09-05" },
    release: null,
    fetchErrors: [],
    sizeKb: 500,
    ...overrides,
  };
}

describe("buildRepoStatus", () => {
  it("carries UNKNOWN through for every field capability-status.json does not document", () => {
    const status = buildRepoStatus(registryRepo(), githubFacts(), undefined, "2026-09-05T00:00:00Z");
    expect(status.providesPublished.value).toBe(UNKNOWN);
    expect(status.osIntegration.status).toBe(UNKNOWN);
    expect(status.verifiedEndToEnd.value).toBe(UNKNOWN);
  });

  it("reflects a real documented fact (provides_published: false) precisely, not as UNKNOWN", () => {
    const status = buildRepoStatus(registryRepo(), githubFacts(), { provides_published: false, provides_evidence: "PR #2 still open" }, "2026-09-05T00:00:00Z");
    expect(status.providesPublished.value).toBe(false);
    expect(status.providesPublished.detail).toBe("PR #2 still open");
  });

  it("marks a nonexistent repo accordingly and still returns a usable object", () => {
    const status = buildRepoStatus(registryRepo(), githubFacts({ exists: false, defaultBranch: UNKNOWN, ci: { conclusion: UNKNOWN, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN } }), undefined, "2026-09-05T00:00:00Z");
    expect(status.exists).toBe(false);
    expect(status.maturity.level).toBe(0);
  });

  it("passes fetch errors through untouched", () => {
    const status = buildRepoStatus(registryRepo(), githubFacts({ fetchErrors: ["pulls.list failed: boom"] }), undefined, "2026-09-05T00:00:00Z");
    expect(status.fetchErrors).toEqual(["pulls.list failed: boom"]);
  });
});

describe("buildGraph", () => {
  it("produces one node per repo and one edge per dependsOn entry", () => {
    const repos = [
      buildRepoStatus(registryRepo({ slug: "a", depends_on: ["b"] }), githubFacts(), undefined, "t"),
      buildRepoStatus(registryRepo({ slug: "b" }), githubFacts(), undefined, "t"),
    ];
    const graph = buildGraph(repos);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([{ from: "a", to: "b", kind: "depends_on" }]);
  });
});

describe("buildOverview", () => {
  it("counts repos by type and sums open PRs/issues", () => {
    const repos = [
      buildRepoStatus(registryRepo({ slug: "a", type: "Skill" }), githubFacts({ openPullRequests: [{ number: 1, title: "x", url: "u", draft: false, mergeableState: "clean", updatedAt: "t", isStale: false }] }), undefined, "t"),
      buildRepoStatus(registryRepo({ slug: "b", type: "OS" }), githubFacts(), undefined, "t"),
    ];
    const overview = buildOverview(repos, []);
    expect(overview.totalRepos).toBe(2);
    expect(overview.reposByType.Skill).toBe(1);
    expect(overview.reposByType.OS).toBe(1);
    expect(overview.openPullRequestsTotal).toBe(1);
  });

  it("excludes OS and Agent repo types from the maturity distribution histogram", () => {
    const repos = [
      buildRepoStatus(registryRepo({ slug: "a", type: "OS" }), githubFacts(), undefined, "t"),
      buildRepoStatus(registryRepo({ slug: "b", type: "Skill" }), githubFacts(), { contract_published: true }, "t"),
    ];
    const overview = buildOverview(repos, []);
    expect(overview.maturityDistribution.totalRepos).toBe(1);
  });

  it("counts ci-failing bottlenecks into ciFailingCount without recomputing the rule itself", () => {
    const repos = [buildRepoStatus(registryRepo(), githubFacts(), undefined, "t")];
    const overview = buildOverview(repos, [{ kind: "ci_failing_default_branch", repoSlug: "x", summary: "s", evidenceUrl: UNKNOWN, detectedAt: "t" }]);
    expect(overview.ciFailingCount).toBe(1);
  });
});
