/**
 * Assembles the final EcosystemSnapshot from already-fetched/computed pieces. Pure
 * functions only -- no I/O here, so every function is directly unit-testable.
 */
import type {
  Bottleneck,
  EcosystemGraph,
  EvidencedBoolean,
  MaturityDistribution,
  OsOverview,
  RepoStatus,
  RepoType,
} from "../../shared/types.js";
import { UNKNOWN } from "../../shared/types.js";
import type { Unknown } from "../../shared/types.js";
import type { CapabilityStatusRepoEntry, RegistryRepo } from "./config.js";
import type { RepoGithubFacts } from "./github.js";
import { computeMaturity } from "./maturity.js";

export function buildRepoStatus(
  registryEntry: RegistryRepo,
  github: RepoGithubFacts,
  status: CapabilityStatusRepoEntry | undefined,
  fetchedAt: string,
  distributionLookup?: { version: string | Unknown; lookupError?: string },
): RepoStatus {
  const maturity = computeMaturity({
    repoType: registryEntry.type,
    github: { exists: github.exists, ci: github.ci, sizeKb: github.sizeKb },
    status,
    distributionLookup,
  });

  const capabilityContractPublished: EvidencedBoolean =
    status?.contract_published === undefined
      ? { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN }
      : { value: status.contract_published, source: "documented", detail: status.as_of ? `as of ${status.as_of}` : "documented" };

  const providesPublished: EvidencedBoolean =
    status?.provides_published === undefined
      ? { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN }
      : { value: status.provides_published, source: "documented", detail: status.provides_evidence ?? "documented" };

  const osIntegrationStatus = status?.os_integration;
  const osIntegration: RepoStatus["osIntegration"] =
    osIntegrationStatus === "integrated" || osIntegrationStatus === "integrated_as_gate" || osIntegrationStatus === "not_integrated"
      ? { status: osIntegrationStatus, detail: status?.os_integration_evidence ?? UNKNOWN, source: "documented" }
      : { status: UNKNOWN, detail: UNKNOWN, source: UNKNOWN };

  const verifiedEndToEnd: EvidencedBoolean =
    status?.verified_e2e === undefined
      ? { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN }
      : { value: status.verified_e2e === "documented", source: "documented", detail: status.verified_e2e_evidence ?? "documented" };

  return {
    slug: registryEntry.slug,
    name: registryEntry.name,
    type: registryEntry.type,
    role: registryEntry.role,
    dependsOn: registryEntry.depends_on,

    exists: github.exists,
    defaultBranch: github.defaultBranch,
    latestCommit: github.latestCommit,
    lastUpdatedAt: github.lastUpdatedAt,

    openPullRequests: github.openPullRequests,
    openIssues: github.openIssues,
    ci: github.ci,
    release: github.release,
    distribution: status?.distribution
      ? { kind: status.distribution.kind as "npm" | "pypi", package: status.distribution.package, latestVersion: distributionLookup?.version ?? UNKNOWN }
      : { kind: UNKNOWN, package: null, latestVersion: UNKNOWN },

    capabilityContractPublished,
    providesPublished,
    osIntegration,
    verifiedEndToEnd,

    maturity,

    fetchedAt,
    fetchErrors: github.fetchErrors,
  };
}

export function buildGraph(repos: RepoStatus[]): EcosystemGraph {
  const nodes = repos.map((r) => ({ slug: r.slug, type: r.type }));
  const edges = repos.flatMap((r) =>
    r.dependsOn.map((to) => ({ from: r.slug, to, kind: "depends_on" as const })),
  );
  return { nodes, edges };
}

/** MATURITY_MODEL.md's ladder is only meaningful for Skill/Provider/Extension repos
 * (see maturity.ts's own note); OS and Agent repos are excluded from this histogram so
 * their "stuck at level 1" status (an artifact of the ladder not applying to them, not
 * a real immaturity) never distorts the ecosystem-wide picture. */
export function buildMaturityDistribution(repos: RepoStatus[]): MaturityDistribution {
  const counts: MaturityDistribution["counts"] = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const r of repos) {
    if (r.type === "OS" || r.type === "Agent") continue;
    counts[r.maturity.level]++;
    total++;
  }
  return { counts, totalRepos: total };
}

export function buildOverview(repos: RepoStatus[], bottlenecks: Bottleneck[]): OsOverview {
  const reposByType: Record<RepoType, number> = { OS: 0, Agent: 0, Skill: 0, Provider: 0, Extension: 0 };
  for (const r of repos) reposByType[r.type]++;

  const openPullRequestsTotal = repos.reduce((sum, r) => sum + r.openPullRequests.length, 0);
  const openIssuesTotal = repos.reduce((sum, r) => sum + r.openIssues.length, 0);
  const ciFailingCount = bottlenecks.filter((b) => b.kind === "ci_failing_default_branch").length;

  const recentlyChangedRepos = repos
    .filter((r) => r.lastUpdatedAt !== UNKNOWN)
    .map((r) => ({ slug: r.slug, lastUpdatedAt: r.lastUpdatedAt as string }))
    .sort((a, b) => (a.lastUpdatedAt < b.lastUpdatedAt ? 1 : -1))
    .slice(0, 10);

  return {
    totalRepos: repos.length,
    reposByType,
    openPullRequestsTotal,
    openIssuesTotal,
    ciFailingCount,
    maturityDistribution: buildMaturityDistribution(repos),
    recentlyChangedRepos,
  };
}
