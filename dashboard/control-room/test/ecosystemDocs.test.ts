import { describe, expect, it } from "vitest";
import { detectDecisionLogDuplicateIds, extractObjective, extractPullRequestCitations, parseRoadmapPhases, parseWorkQueueTasks } from "../src/adapters/ecosystemDocs.js";
import { UNKNOWN } from "../src/types.js";
import { makeFakeRepoRoot } from "./fixtures.js";

describe("extractObjective", () => {
  it("extracts the README's own one-sentence description verbatim", () => {
    const root = makeFakeRepoRoot();
    const { statement, evidence } = extractObjective(root);
    expect(statement).toBe("A test objective statement for unit tests.");
    expect(evidence.source).toBe("doc");
  });

  it("returns UNKNOWN, never a guess, when the section is missing", () => {
    const root = makeFakeRepoRoot({ readme: "# Test OS\n\nNo objective section here.\n" });
    const { statement } = extractObjective(root);
    expect(statement).toBe(UNKNOWN);
  });
});

describe("parseRoadmapPhases", () => {
  it("parses a single-line Status and a multi-line Status the same way", () => {
    const roadmap = [
      "## Phase 0 — First",
      "",
      "**Status: CURRENT / IMPLEMENTED**",
      "",
      "**Depends on:** nothing.",
      "",
      "## Phase 1 — Second",
      "",
      "**Status: substantially complete once this document",
      "and its two companions land**",
      "",
      "**Depends on: Phase 0, genuinely.**",
    ].join("\n");
    const root = makeFakeRepoRoot({ roadmap });
    const phases = parseRoadmapPhases(root);
    expect(phases).toHaveLength(2);
    expect(phases[0]).toMatchObject({ id: "Phase 0", status: "DONE", dependsOnPhaseIds: [] });
    expect(phases[1].statusText).toBe("substantially complete once this document and its two companions land");
    expect(phases[1].status).toBe("DONE");
    expect(phases[1].dependsOnPhaseIds).toEqual(["Phase 0"]);
  });

  it("reports UNKNOWN, never a guess, for a phase with no Status line at all", () => {
    const roadmap = "## Phase 3 — No status line\n\n**Delivers:** something.\n\n**Depends on: Phase 1 + Phase 2.**\n";
    const root = makeFakeRepoRoot({ roadmap });
    const phases = parseRoadmapPhases(root);
    expect(phases).toHaveLength(1);
    expect(phases[0].status).toBe("UNKNOWN");
    expect(phases[0].statusText).toBe(UNKNOWN);
    expect(phases[0].dependsOnPhaseIds).toEqual(["Phase 1", "Phase 2"]);
  });

  it("returns an empty array for an empty ROADMAP.md", () => {
    const root = makeFakeRepoRoot({ roadmap: "" });
    expect(parseRoadmapPhases(root)).toEqual([]);
  });
});

describe("parseWorkQueueTasks", () => {
  const knownRepoNames = ["video-production-agent", "qc-skill"];

  it("maps DONE/LIVE/RESOLVED/IMPLEMENTED markers to the closed status vocabulary", () => {
    const workQueue = [
      "## 1. ~~Shipped thing~~ — DONE 2026-01-01",
      "## 2. ~~Deployed thing~~ — LIVE 2026-01-01, verified against the real deployed site",
      "## 3. ~~Decided thing~~ — RESOLVED 2026-01-01",
      "## 4. ~~Implemented with PR~~ — IMPLEMENTED 2026-01-01 (Draft PR open)",
      "## 5. Open item with no marker",
      "## 6. VISION-tier, not yet actionable: some future idea",
    ].join("\n");
    const root = makeFakeRepoRoot({ workQueue });
    const tasks = parseWorkQueueTasks(root, knownRepoNames);
    expect(tasks.map((t) => t.status)).toEqual(["DONE", "VERIFIED", "DONE", "DRAFT_PR", "UNKNOWN", "DEFERRED"]);
  });

  it("attaches phaseId only when the item's own text names a Phase, else UNKNOWN", () => {
    const workQueue = "## 1. References Phase 4\n\nThis relates to Phase 4 of the roadmap.\n\n## 2. No phase reference\n\nJust prose.\n";
    const root = makeFakeRepoRoot({ workQueue });
    const tasks = parseWorkQueueTasks(root, knownRepoNames);
    expect(tasks[0].phaseId).toBe("Phase 4");
    expect(tasks[1].phaseId).toBe(UNKNOWN);
  });

  it("never invents an epic or milestone (WORK_QUEUE.md has no such concept)", () => {
    const root = makeFakeRepoRoot({ workQueue: "## 1. Anything\n" });
    const tasks = parseWorkQueueTasks(root, knownRepoNames);
    expect(tasks[0].epic).toBe(UNKNOWN);
    expect(tasks[0].milestone).toBe(UNKNOWN);
  });

  it("returns an empty array for an empty WORK_QUEUE.md", () => {
    const root = makeFakeRepoRoot({ workQueue: "" });
    expect(parseWorkQueueTasks(root, knownRepoNames)).toEqual([]);
  });
});

describe("extractPullRequestCitations", () => {
  const knownRepoNames = ["video-production-agent", "qc-skill"];

  it("resolves an unambiguous owner/repo#N citation directly, no heuristic needed", () => {
    const text = "See [kajisho5/video-production-agent#27](https://github.com/kajisho5/video-production-agent/pull/27).";
    const citations = extractPullRequestCitations(text, knownRepoNames);
    expect(citations).toEqual([{ repoSlug: "video-production-agent", number: 27, citedText: expect.stringContaining("video-production-agent#27") }]);
  });

  it("attributes a bare PR #N to a nearby known repo name", () => {
    const text = "Fixed in qc-skill via PR #5 last week.";
    const citations = extractPullRequestCitations(text, knownRepoNames);
    expect(citations).toEqual([{ repoSlug: "qc-skill", number: 5, citedText: expect.any(String) }]);
  });

  it("marks a PR #N with no nearby known repo name as UNKNOWN, never a guess", () => {
    const text = "This was fixed by PR #99 somewhere.";
    const citations = extractPullRequestCitations(text, knownRepoNames);
    expect(citations[0].repoSlug).toBe(UNKNOWN);
  });

  it("deduplicates the same (repo, number) cited by both patterns", () => {
    const text = "kajisho5/qc-skill#5 -- also written as qc-skill PR #5 elsewhere.";
    const citations = extractPullRequestCitations(text, knownRepoNames);
    expect(citations).toHaveLength(1);
  });

  it("returns an empty array when no PR is cited", () => {
    expect(extractPullRequestCitations("Nothing here.", knownRepoNames)).toEqual([]);
  });
});

describe("detectDecisionLogDuplicateIds", () => {
  it("detects a real duplicate decision id as roadmap drift", () => {
    const decisionLog = "## D1 — First\n\nBody.\n\n## D7 — Something\n\nBody.\n\n## D7 — Something else entirely\n\nBody.\n";
    const root = makeFakeRepoRoot({ decisionLog });
    const drifts = detectDecisionLogDuplicateIds(root);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].summary).toContain("D7");
  });

  it("reports no drift when every decision id is unique", () => {
    const decisionLog = "## D1 — First\n\nBody.\n\n## D2 — Second\n\nBody.\n";
    const root = makeFakeRepoRoot({ decisionLog });
    expect(detectDecisionLogDuplicateIds(root)).toEqual([]);
  });

  it("handles an empty DECISION_LOG.md without error", () => {
    const root = makeFakeRepoRoot({ decisionLog: "" });
    expect(detectDecisionLogDuplicateIds(root)).toEqual([]);
  });
});
