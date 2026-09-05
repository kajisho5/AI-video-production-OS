/**
 * Explicit-evidence bottleneck detection (task requirement: "do not infer bottlenecks
 * from arbitrary heuristics"). Every rule below cites the exact field it read and the
 * exact condition that fired -- no scoring, no weighting, no "looks stuck" judgment.
 * Pure function: RepoStatus[] in, Bottleneck[] out, fully unit-testable.
 */
import type { Bottleneck, RepoStatus } from "../../shared/types.js";

const STALE_PR_LABEL_DAYS = 14; // matches github.ts's STALE_PR_DAYS; kept in sync manually since they're different packages' concerns (fetch vs. detect)

export function detectBottlenecks(repos: RepoStatus[]): Bottleneck[] {
  const now = new Date().toISOString();
  const bySlug = new Map(repos.map((r) => [r.slug, r]));
  const bottlenecks: Bottleneck[] = [];

  for (const repo of repos) {
    if (repo.ci.conclusion === "failure") {
      bottlenecks.push({
        kind: "ci_failing_default_branch",
        repoSlug: repo.slug,
        summary: `CI is failing on ${repo.defaultBranch === "UNKNOWN" ? "the default branch" : `\`${repo.defaultBranch}\``} (workflow: ${repo.ci.workflowName})`,
        evidenceUrl: repo.ci.runUrl,
        detectedAt: now,
      });
    }

    for (const pr of repo.openPullRequests) {
      if (pr.mergeableState === "dirty") {
        bottlenecks.push({
          kind: "pr_merge_conflict",
          repoSlug: repo.slug,
          summary: `PR #${pr.number} ("${pr.title}") has a merge conflict against its base branch`,
          evidenceUrl: pr.url,
          detectedAt: now,
        });
      }
      if (pr.isStale) {
        bottlenecks.push({
          kind: "pr_stale_open",
          repoSlug: repo.slug,
          summary: `PR #${pr.number} ("${pr.title}") has had no update in over ${STALE_PR_LABEL_DAYS} days`,
          evidenceUrl: pr.url,
          detectedAt: now,
        });
      }
    }

    if (repo.type === "Skill" && repo.providesPublished.value === false) {
      bottlenecks.push({
        kind: "capability_not_declared",
        repoSlug: repo.slug,
        summary: `Capability Contract has no \`provides\` field yet (${repo.providesPublished.detail})`,
        evidenceUrl: "UNKNOWN",
        detectedAt: now,
      });
    }

    if (repo.type === "Skill" && repo.osIntegration.status === "not_integrated") {
      bottlenecks.push({
        kind: "not_os_integrated",
        repoSlug: repo.slug,
        summary: `video-production-agent has no known adapter for this Skill yet`,
        evidenceUrl: "UNKNOWN",
        detectedAt: now,
      });
    }

    for (const depSlug of repo.dependsOn) {
      const dep = bySlug.get(depSlug);
      if (dep && dep.type === "Skill" && dep.osIntegration.status === "not_integrated") {
        bottlenecks.push({
          kind: "dependency_not_integrated",
          repoSlug: repo.slug,
          summary: `Depends on ${depSlug}, which is not yet OS-integrated`,
          evidenceUrl: "UNKNOWN",
          detectedAt: now,
        });
      }
    }
  }

  return bottlenecks;
}
