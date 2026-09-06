/**
 * Combines every adapter's output into one ControlRoomSnapshot. This is the only
 * module that computes derived values (next-executable-task, roadmap drift,
 * phase-dependency blockers) -- every one of those is built strictly from the
 * adapters' own parsed/fetched facts, never from a second independent guess.
 */
import type { EcosystemSnapshot } from "../../shared/types.js";
// Reused, never duplicated: the OS Dashboard aggregator already defines and loads
// these two structured ecosystem-state files (docs/ecosystem/registry.json,
// docs/ecosystem/capability-status.json).
import type { CapabilityStatusFile, RegistryFile } from "../../aggregator/src/config.js";
import type { Blocker, ControlRoomSnapshot, Dependency, LiveRepoFacts, Phase, RepositoryState, RoadmapDrift, SystemIntelligenceStatus, Task, VerificationRecord } from "./types.js";
import { UNKNOWN } from "./types.js";

export function buildDependencies(registry: RegistryFile): Dependency[] {
  const deps: Dependency[] = [];
  for (const repo of registry.repos) {
    for (const to of repo.depends_on) {
      deps.push({ fromSlug: repo.slug, toSlug: to, evidence: { source: "structured_file", locator: "docs/ecosystem/registry.json", detail: `${repo.slug} depends_on ${to}` } });
    }
  }
  return deps;
}

export function buildRepositories(registry: RegistryFile, capabilityStatus: CapabilityStatusFile, ecosystemSnapshot: EcosystemSnapshot | null): RepositoryState[] {
  const liveBySlug = new Map((ecosystemSnapshot?.repos ?? []).map((r) => [r.slug, r]));
  return registry.repos.map((repo) => {
    const cap = capabilityStatus.repos[repo.slug];
    const live = liveBySlug.get(repo.slug);
    const liveState: LiveRepoFacts | null = live
      ? {
          defaultBranch: live.defaultBranch,
          openPullRequestCount: live.openPullRequests.length,
          openIssueCount: live.openIssues.length,
          ciConclusion: live.ci.conclusion,
          maturityLevel: live.maturity.level,
        }
      : null;
    return {
      slug: repo.slug,
      name: repo.name,
      type: repo.type,
      role: repo.role,
      dependsOn: repo.depends_on,
      liveState,
      contractPublished: cap?.contract_published ?? UNKNOWN,
      providesPublished: cap?.provides_published ?? UNKNOWN,
      osIntegration: cap?.os_integration ?? UNKNOWN,
      verifiedEndToEnd: cap?.verified_e2e ?? UNKNOWN,
      evidence: [
        { source: "structured_file", locator: "docs/ecosystem/registry.json", detail: `roster entry for ${repo.slug}` },
        cap
          ? { source: "structured_file", locator: "docs/ecosystem/capability-status.json", detail: `documented as of ${cap.as_of ?? "unknown date"}` }
          : { source: "structured_file", locator: "docs/ecosystem/capability-status.json", detail: "no entry for this repo" },
        live
          ? { source: "generated_snapshot", locator: "dashboard/web/public/data/ecosystem-snapshot.json", detail: `live GitHub facts as of ${ecosystemSnapshot!.generatedAt}` }
          : { source: "generated_snapshot", locator: "dashboard/web/public/data/ecosystem-snapshot.json", detail: "no live snapshot available at generation time" },
      ],
    };
  });
}

/** "Next executable task" per the task's own definition: a WORK_QUEUE.md item with
 * no completion marker and no citable PR yet -- i.e. genuinely pre-PR, ready-or-not
 * work, taken in the document's own priority order (its header states items are
 * "Ordered by the priority this project operates under"). Always returned as an
 * explicit recommendation (`isInference: true`), never as settled fact -- an
 * UNKNOWN status is not "this is next," it is "this generator does not know this
 * is done," and the two are kept visibly distinct in the resulting object's own
 * `reason` text. */
export function computeNextExecutableTask(tasks: Task[]): ControlRoomSnapshot["nextExecutableTask"] {
  const candidate = tasks.find((t) => t.status === "UNKNOWN" && t.pullRequests.length === 0);
  if (!candidate) return null;
  return {
    taskId: candidate.id,
    reason: `Recommendation, not a verified fact: WORK_QUEUE.md item ${candidate.id} is the first item (in the document's own stated priority order) with no completion marker and no PR opened yet.`,
    dependencies: [],
    blockers: [],
    repositorySlug: UNKNOWN,
    evidence: candidate.evidence,
    isInference: true,
  };
}

export function computePhaseDependencyBlockers(phases: Phase[]): Blocker[] {
  const byId = new Map(phases.map((p) => [p.id, p]));
  const blockers: Blocker[] = [];
  for (const phase of phases) {
    if (phase.status === "DONE") continue;
    for (const depId of phase.dependsOnPhaseIds) {
      const dep = byId.get(depId);
      if (dep && dep.status !== "DONE") {
        blockers.push({
          id: `phase-${phase.id}-blocked-by-${depId}`.replace(/\s+/g, "-").toLowerCase(),
          description: `${phase.id} depends on ${depId}, which is not yet done (status: ${dep.statusText}).`,
          affects: [phase.id],
          evidence: [...phase.evidence, ...dep.evidence],
        });
      }
    }
  }
  return blockers;
}

/** Cross-checks each Task's own claimed status against the live state of any PR it
 * cites -- the concrete example the task's own instructions ask for (section 14):
 * two sources this generator can both read, shown as evidence, never silently
 * resolved in either's favor. */
export function computeTaskPrDrift(tasks: Task[]): RoadmapDrift[] {
  const drifts: RoadmapDrift[] = [];
  for (const task of tasks) {
    for (const pr of task.pullRequests) {
      if (pr.resolution === "not_found") {
        drifts.push({
          id: `task-${task.id}-pr-${pr.repoSlug}-${pr.number}-not-found`,
          summary: `WORK_QUEUE.md item ${task.id} cites ${pr.repoSlug}#${pr.number}, but that pull request could not be found on GitHub.`,
          sourceA: { source: "doc", locator: `docs/ecosystem/WORK_QUEUE.md#item-${task.id}`, detail: pr.citedText },
          sourceB: { source: "github_api", locator: `https://github.com/kajisho5/${pr.repoSlug}/pull/${pr.number}`, detail: "not found (404)" },
          detectedAt: new Date().toISOString(),
        });
        continue;
      }
      if (pr.resolution !== "resolved" || !pr.state) continue;
      if (task.status === "DRAFT_PR" && pr.state.merged) {
        drifts.push({
          id: `task-${task.id}-pr-${pr.repoSlug}-${pr.number}-already-merged`,
          summary: `WORK_QUEUE.md item ${task.id} ("${task.title}") is described as having an open Draft PR, but ${pr.repoSlug}#${pr.number} is already merged.`,
          sourceA: { source: "doc", locator: `docs/ecosystem/WORK_QUEUE.md#item-${task.id}`, detail: task.statusMarker ?? task.title },
          sourceB: pr.state.evidence,
          detectedAt: new Date().toISOString(),
        });
      }
      if ((task.status === "DONE" || task.status === "VERIFIED") && pr.state.state === "open" && !pr.state.merged) {
        drifts.push({
          id: `task-${task.id}-pr-${pr.repoSlug}-${pr.number}-still-open`,
          summary: `WORK_QUEUE.md item ${task.id} ("${task.title}") is marked ${task.status}, but its cited PR ${pr.repoSlug}#${pr.number} is still open, not merged.`,
          sourceA: { source: "doc", locator: `docs/ecosystem/WORK_QUEUE.md#item-${task.id}`, detail: task.statusMarker ?? task.title },
          sourceB: pr.state.evidence,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }
  return drifts;
}

/** The one Verification source this generator can read automatically: WORK_QUEUE.md
 * items the document itself marks LIVE/verified (mapped to Task status VERIFIED).
 * A Task without that marker is NOT treated as unverified-and-failing -- it is
 * simply not represented here, since "not verified" and "verification failed" are
 * different claims and only the former is supported by this evidence. */
export function extractVerificationRecords(tasks: Task[]): VerificationRecord[] {
  return tasks
    .filter((t) => t.status === "VERIFIED")
    .map((t) => ({
      id: `verification-task-${t.id}`,
      subject: `WORK_QUEUE.md item ${t.id}: ${t.title}`,
      method: t.statusMarker ?? "documented as verified in WORK_QUEUE.md",
      result: "PASS" as const,
      evidence: t.evidence,
    }));
}

export function emptySystemIntelligenceStatus(): SystemIntelligenceStatus {
  return { available: false, snapshotDirectory: null, reason: "not configured", findings: [], recommendations: [], researchCount: 0, verificationCount: 0 };
}
