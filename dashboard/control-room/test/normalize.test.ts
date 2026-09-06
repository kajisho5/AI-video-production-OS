import { describe, expect, it } from "vitest";
import { buildDependencies, buildRepositories, computeNextExecutableTask, computePhaseDependencyBlockers, computeTaskPrDrift, extractVerificationRecords } from "../src/normalize.js";
import type { Phase, PullRequestState, Task } from "../src/types.js";
import { UNKNOWN } from "../src/types.js";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    title: "A task",
    source: "WORK_QUEUE.md",
    phaseId: UNKNOWN,
    epic: UNKNOWN,
    milestone: UNKNOWN,
    status: "UNKNOWN",
    statusMarker: null,
    dependencies: [],
    blockers: [],
    pullRequests: [],
    evidence: [{ source: "doc", locator: "docs/ecosystem/WORK_QUEUE.md#item-1", detail: "heading" }],
    isRecommendedNext: false,
    ...overrides,
  };
}

function makePr(overrides: Partial<PullRequestState>): PullRequestState {
  return {
    number: 1,
    repoSlug: "video-production-agent",
    title: "Some PR",
    url: "https://github.com/kajisho5/video-production-agent/pull/1",
    draft: true,
    merged: false,
    state: "open",
    mergeableState: UNKNOWN,
    ciConclusion: UNKNOWN,
    evidence: { source: "github_api", locator: "https://github.com/kajisho5/video-production-agent/pull/1", detail: "pulls.get" },
    ...overrides,
  };
}

describe("computeNextExecutableTask", () => {
  it("recommends the first UNKNOWN, no-PR task in file order, explicitly labeled as inference", () => {
    const tasks = [makeTask({ id: "1", status: "DONE" }), makeTask({ id: "2", status: "UNKNOWN" }), makeTask({ id: "3", status: "UNKNOWN" })];
    const next = computeNextExecutableTask(tasks);
    expect(next?.taskId).toBe("2");
    expect(next?.isInference).toBe(true);
    expect(next?.reason).toContain("Recommendation, not a verified fact");
  });

  it("skips an UNKNOWN task that already has a PR open -- it's already in flight, not pre-PR", () => {
    const tasks = [makeTask({ id: "1", status: "UNKNOWN", pullRequests: [{ repoSlug: "x", number: 1, citedText: "", resolution: "resolved" }] }), makeTask({ id: "2", status: "UNKNOWN" })];
    expect(computeNextExecutableTask(tasks)?.taskId).toBe("2");
  });

  it("returns null when there is no pre-PR work at all (never invents a candidate)", () => {
    const tasks = [makeTask({ id: "1", status: "DONE" }), makeTask({ id: "2", status: "DEFERRED" })];
    expect(computeNextExecutableTask(tasks)).toBeNull();
  });

  it("returns null for an empty task list", () => {
    expect(computeNextExecutableTask([])).toBeNull();
  });
});

describe("computePhaseDependencyBlockers", () => {
  function makePhase(overrides: Partial<Phase>): Phase {
    return { id: "Phase 0", title: "T", status: "UNKNOWN", statusText: UNKNOWN, dependsOnPhaseIds: [], evidence: [{ source: "doc", locator: "docs/ROADMAP.md", detail: "d" }], ...overrides };
  }

  it("flags a phase blocked by an unfinished dependency", () => {
    const phases = [makePhase({ id: "Phase 1", status: "DONE" }), makePhase({ id: "Phase 2", status: "UNKNOWN", dependsOnPhaseIds: ["Phase 1"] })];
    // Phase 2 itself is not done and depends on nothing unfinished -- no blocker for it.
    expect(computePhaseDependencyBlockers(phases)).toEqual([]);

    const blocked = [makePhase({ id: "Phase 3", status: "UNKNOWN" }), makePhase({ id: "Phase 4", status: "UNKNOWN", dependsOnPhaseIds: ["Phase 3"] })];
    const blockers = computePhaseDependencyBlockers(blocked);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].description).toContain("Phase 4 depends on Phase 3");
  });

  it("never blocks a DONE phase, even if its dependency is unfinished", () => {
    const phases = [makePhase({ id: "Phase 1", status: "UNKNOWN" }), makePhase({ id: "Phase 2", status: "DONE", dependsOnPhaseIds: ["Phase 1"] })];
    expect(computePhaseDependencyBlockers(phases)).toEqual([]);
  });

  it("does not fabricate a blocker for a dependency id that doesn't resolve to a known phase", () => {
    const phases = [makePhase({ id: "Phase 9", status: "UNKNOWN", dependsOnPhaseIds: ["Phase 999"] })];
    expect(computePhaseDependencyBlockers(phases)).toEqual([]);
  });

  it("returns an empty array for an empty phase list", () => {
    expect(computePhaseDependencyBlockers([])).toEqual([]);
  });
});

describe("computeTaskPrDrift", () => {
  it("flags a DRAFT_PR task whose cited PR is already merged", () => {
    const tasks = [makeTask({ id: "8", status: "DRAFT_PR", pullRequests: [{ repoSlug: "video-production-agent", number: 27, citedText: "", resolution: "resolved", state: makePr({ merged: true, state: "closed" }) }] })];
    const drift = computeTaskPrDrift(tasks);
    expect(drift).toHaveLength(1);
    expect(drift[0].summary).toContain("already merged");
  });

  it("flags a DONE task whose cited PR is still open", () => {
    const tasks = [makeTask({ id: "2", status: "DONE", pullRequests: [{ repoSlug: "video-production-agent", number: 1, citedText: "", resolution: "resolved", state: makePr({ merged: false, state: "open" }) }] })];
    const drift = computeTaskPrDrift(tasks);
    expect(drift).toHaveLength(1);
    expect(drift[0].summary).toContain("still open");
  });

  it("flags a citation that resolved to not_found", () => {
    const tasks = [makeTask({ id: "3", status: "DONE", pullRequests: [{ repoSlug: "video-production-agent", number: 404, citedText: "PR #404", resolution: "not_found" }] })];
    const drift = computeTaskPrDrift(tasks);
    expect(drift).toHaveLength(1);
    expect(drift[0].summary).toContain("could not be found");
  });

  it("reports no drift when a DRAFT_PR task's cited PR is genuinely still open", () => {
    const tasks = [makeTask({ id: "8", status: "DRAFT_PR", pullRequests: [{ repoSlug: "video-production-agent", number: 27, citedText: "", resolution: "resolved", state: makePr({ merged: false, state: "open" }) }] })];
    expect(computeTaskPrDrift(tasks)).toEqual([]);
  });

  it("never evaluates an ambiguous-repo or unresolved citation as drift", () => {
    const tasks = [
      makeTask({ id: "1", status: "DONE", pullRequests: [{ repoSlug: UNKNOWN, number: 1, citedText: "", resolution: "ambiguous_repo" }] }),
      makeTask({ id: "2", status: "DONE", pullRequests: [{ repoSlug: "x", number: 2, citedText: "", resolution: "unresolved_error" }] }),
    ];
    expect(computeTaskPrDrift(tasks)).toEqual([]);
  });
});

describe("extractVerificationRecords", () => {
  it("extracts a PASS record only for VERIFIED tasks", () => {
    const tasks = [makeTask({ id: "7", status: "VERIFIED", statusMarker: "LIVE, verified against the real deployed site" }), makeTask({ id: "1", status: "UNKNOWN" })];
    const records = extractVerificationRecords(tasks);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ result: "PASS", subject: expect.stringContaining("item 7") });
  });

  it("returns an empty array when nothing is marked VERIFIED", () => {
    expect(extractVerificationRecords([makeTask({ status: "DONE" })])).toEqual([]);
  });
});

describe("buildDependencies", () => {
  it("builds one Dependency edge per depends_on entry, with evidence", () => {
    const registry = { schema_version: 1, updated_at: "2026-01-01", repos: [{ slug: "a", name: "a", type: "Skill" as const, role: "", depends_on: ["b", "c"] }, { slug: "b", name: "b", type: "Skill" as const, role: "", depends_on: [] }] };
    const deps = buildDependencies(registry);
    expect(deps).toEqual([
      { fromSlug: "a", toSlug: "b", evidence: expect.objectContaining({ source: "structured_file" }) },
      { fromSlug: "a", toSlug: "c", evidence: expect.objectContaining({ source: "structured_file" }) },
    ]);
  });

  it("returns an empty array when no repo depends on anything", () => {
    const registry = { schema_version: 1, updated_at: "2026-01-01", repos: [{ slug: "a", name: "a", type: "OS" as const, role: "", depends_on: [] }] };
    expect(buildDependencies(registry)).toEqual([]);
  });
});

describe("buildRepositories", () => {
  const registry = { schema_version: 1, updated_at: "2026-01-01", repos: [{ slug: "kajisho5/a", name: "a", type: "Skill" as const, role: "role a", depends_on: [] }] };

  it("marks every capability-status field UNKNOWN when the repo has no capability-status.json entry (never guesses 'false')", () => {
    const capabilityStatus = { schema_version: 1, updated_at: "2026-01-01", repos: {} };
    const repos = buildRepositories(registry, capabilityStatus, null);
    expect(repos[0]).toMatchObject({ contractPublished: UNKNOWN, providesPublished: UNKNOWN, osIntegration: UNKNOWN, verifiedEndToEnd: UNKNOWN, liveState: null });
  });

  it("uses the OS Dashboard's own generated ecosystem-snapshot.json for live facts, never recomputing them", () => {
    const capabilityStatus = { schema_version: 1, updated_at: "2026-01-01", repos: { "kajisho5/a": { contract_published: true } } };
    const ecosystemSnapshot = {
      schemaVersion: 1 as const,
      generatedAt: "2026-01-01T00:00:00Z",
      generator: { name: "x", version: "1" },
      authTokenPresent: true,
      rateLimit: { remaining: 100, limit: 5000 },
      overview: {} as never,
      repos: [{ slug: "kajisho5/a", name: "a", type: "Skill" as const, role: "", dependsOn: [], exists: true, defaultBranch: "main", latestCommit: UNKNOWN, lastUpdatedAt: UNKNOWN, openPullRequests: [{} as never], openIssues: [], ci: { conclusion: "success" as const, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN }, release: null, distribution: { kind: "none" as const, package: null, latestVersion: UNKNOWN }, capabilityContractPublished: { value: true, source: "documented" as const, detail: UNKNOWN }, providesPublished: { value: true, source: "documented" as const, detail: UNKNOWN }, osIntegration: { status: "integrated" as const, detail: UNKNOWN, source: "documented" as const }, verifiedEndToEnd: { value: UNKNOWN, source: "documented" as const, detail: UNKNOWN }, maturity: { level: 3 as const, evidence: [] }, fetchedAt: "2026-01-01T00:00:00Z", fetchErrors: [] }],
      agent: null,
      bottlenecks: [],
      graph: { nodes: [], edges: [] },
      unreachableRepos: [],
    };
    const repos = buildRepositories(registry, capabilityStatus, ecosystemSnapshot);
    expect(repos[0].liveState).toEqual({ defaultBranch: "main", openPullRequestCount: 1, openIssueCount: 0, ciConclusion: "success", maturityLevel: 3 });
    expect(repos[0].contractPublished).toBe(true);
  });
});
