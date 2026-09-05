import { describe, expect, it } from "vitest";
import { detectBottlenecks } from "../src/bottlenecks.js";
import type { RepoStatus } from "../../shared/types.js";
import { UNKNOWN } from "../../shared/types.js";

function baseRepo(overrides: Partial<RepoStatus> = {}): RepoStatus {
  return {
    slug: "kajisho5/example-skill",
    name: "example-skill",
    type: "Skill",
    role: "test",
    dependsOn: [],
    exists: true,
    defaultBranch: "main",
    latestCommit: UNKNOWN,
    lastUpdatedAt: UNKNOWN,
    openPullRequests: [],
    openIssues: [],
    ci: { conclusion: "success", workflowName: "tests", runUrl: "https://x", updatedAt: "2026-09-05" },
    release: null,
    distribution: { kind: UNKNOWN, package: null, latestVersion: UNKNOWN },
    capabilityContractPublished: { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN },
    providesPublished: { value: true, source: "documented", detail: "test" },
    osIntegration: { status: "integrated", detail: "test", source: "documented" },
    verifiedEndToEnd: { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN },
    maturity: { level: 3, evidence: [] },
    fetchedAt: "2026-09-05T00:00:00Z",
    fetchErrors: [],
    ...overrides,
  };
}

describe("detectBottlenecks", () => {
  it("flags a repo with failing CI on its default branch", () => {
    const repo = baseRepo({ ci: { conclusion: "failure", workflowName: "tests", runUrl: "https://x/run/1", updatedAt: "x" } });
    const result = detectBottlenecks([repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "ci_failing_default_branch", repoSlug: repo.slug }));
  });

  it("does not flag a repo with green CI", () => {
    const repo = baseRepo();
    const result = detectBottlenecks([repo]);
    expect(result.some((b) => b.kind === "ci_failing_default_branch")).toBe(false);
  });

  it("flags a PR with a real merge conflict (mergeableState === 'dirty', GitHub's own value)", () => {
    const repo = baseRepo({
      openPullRequests: [{ number: 24, title: "Add provides", url: "https://x/pr/24", draft: true, mergeableState: "dirty", updatedAt: "2026-09-05", isStale: false }],
    });
    const result = detectBottlenecks([repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "pr_merge_conflict", repoSlug: repo.slug }));
  });

  it("does not flag a PR whose mergeableState is 'clean'", () => {
    const repo = baseRepo({
      openPullRequests: [{ number: 24, title: "Add provides", url: "https://x/pr/24", draft: true, mergeableState: "clean", updatedAt: "2026-09-05", isStale: false }],
    });
    const result = detectBottlenecks([repo]);
    expect(result.some((b) => b.kind === "pr_merge_conflict")).toBe(false);
  });

  it("flags a stale open PR (isStale precomputed by the fetcher, not recomputed here)", () => {
    const repo = baseRepo({
      openPullRequests: [{ number: 5, title: "old PR", url: "https://x/pr/5", draft: false, mergeableState: "clean", updatedAt: "2020-01-01", isStale: true }],
    });
    const result = detectBottlenecks([repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "pr_stale_open", repoSlug: repo.slug }));
  });

  it("flags a Skill whose Capability Contract has no provides field yet (real case: subtitle-skill as of 2026-09-05)", () => {
    const repo = baseRepo({ providesPublished: { value: false, source: "documented", detail: "PR #2 still open" } });
    const result = detectBottlenecks([repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "capability_not_declared", repoSlug: repo.slug }));
  });

  it("does not flag capability_not_declared when providesPublished is UNKNOWN (undocumented, not confirmed absent)", () => {
    const repo = baseRepo({ providesPublished: { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN } });
    const result = detectBottlenecks([repo]);
    expect(result.some((b) => b.kind === "capability_not_declared")).toBe(false);
  });

  it("flags a Skill not yet OS-integrated", () => {
    const repo = baseRepo({ osIntegration: { status: "not_integrated", detail: "no adapter found", source: "documented" } });
    const result = detectBottlenecks([repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "not_os_integrated", repoSlug: repo.slug }));
  });

  it("flags a repo whose dependency is not OS-integrated", () => {
    const dep = baseRepo({ slug: "kajisho5/dep-skill", osIntegration: { status: "not_integrated", detail: "x", source: "documented" } });
    const repo = baseRepo({ slug: "kajisho5/consumer-skill", dependsOn: ["kajisho5/dep-skill"] });
    const result = detectBottlenecks([dep, repo]);
    expect(result).toContainEqual(expect.objectContaining({ kind: "dependency_not_integrated", repoSlug: repo.slug }));
  });

  it("produces no bottlenecks for a fully healthy repo", () => {
    const result = detectBottlenecks([baseRepo()]);
    expect(result).toEqual([]);
  });

  it("qc-skill's real integrated_as_gate status is not flagged as not_os_integrated (ADR-032)", () => {
    const repo = baseRepo({ slug: "kajisho5/qc-skill", osIntegration: { status: "integrated_as_gate", detail: "final promotion gate", source: "documented" } });
    const result = detectBottlenecks([repo]);
    expect(result.some((b) => b.kind === "not_os_integrated")).toBe(false);
  });
});
