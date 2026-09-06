/**
 * The normalized Ecosystem Status Model.
 *
 * This is the ONLY shape that crosses the aggregator -> UI boundary
 * (docs/adr/ADR-011-ecosystem-dashboard.md). The aggregator (dashboard/aggregator)
 * produces exactly one EcosystemSnapshot per run and writes it as JSON; the UI
 * (dashboard/web) only ever reads that JSON. Neither side re-derives facts the other
 * already computed -- if the UI needs a new derived value, it belongs in the
 * aggregator, not in a component.
 *
 * `Unknown` is a real, first-class value throughout this model, never represented as
 * `null`, `undefined`, `0`, or an empty string -- code consuming this model must
 * handle it explicitly (see dashboard/web/src/components/StatusValue.tsx).
 */

export const UNKNOWN = "UNKNOWN" as const;
export type Unknown = typeof UNKNOWN;

export type RepoType = "OS" | "Agent" | "Skill" | "Provider" | "Extension";

/** MATURITY_MODEL.md's seven levels, 0-6. */
export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MATURITY_LEVEL_NAMES: Record<MaturityLevel, string> = {
  0: "Proposed",
  1: "Scaffolded",
  2: "Contract Published",
  3: "Capability Declared",
  4: "OS Integrated",
  5: "Verified End-to-End",
  6: "Distributed",
};

export interface CommitSummary {
  sha: string;
  message: string;
  author: string | Unknown;
  date: string; // ISO 8601
  url: string;
}

export type CiConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "timed_out"
  | "action_required"
  | "in_progress"
  | Unknown;

export interface CiStatus {
  conclusion: CiConclusion;
  workflowName: string | Unknown;
  runUrl: string | Unknown;
  updatedAt: string | Unknown;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  /** GitHub's own mergeable_state; "unknown" is GitHub's own value, distinct from this model's UNKNOWN sentinel (which means "we could not fetch this at all"). */
  mergeableState: string | Unknown;
  updatedAt: string;
  isStale: boolean;
}

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  labels: string[];
}

export interface ReleaseSummary {
  tagName: string;
  publishedAt: string;
  url: string;
}

export interface DistributionStatus {
  kind: "npm" | "pypi" | "none" | Unknown;
  package: string | null;
  latestVersion: string | Unknown;
}

/** Evidence tag distinguishing what the aggregator verified live vs. what it read
 * from docs/ecosystem/capability-status.json (see MATURITY_MODEL.md). `package_registry`
 * is a live lookup against npm/PyPI's own API (see aggregator/src/packageRegistry.ts) --
 * distinct from `documented` (capability-status.json merely claims a package exists). */
export type EvidenceSource = "github_api" | "documented" | "package_registry" | Unknown;

export interface EvidencedBoolean {
  value: boolean | Unknown;
  source: EvidenceSource;
  detail: string | Unknown;
}

export interface MaturityAssessment {
  level: MaturityLevel;
  /** One entry per level 0..level+1 actually evaluated, so the UI can show exactly
   * which evidence was checked and which was missing -- never just the final number. */
  evidence: Array<{
    level: MaturityLevel;
    met: boolean | Unknown;
    detail: string;
    source: EvidenceSource;
  }>;
}

export interface RepoStatus {
  slug: string; // "owner/repo"
  name: string;
  type: RepoType;
  role: string;
  dependsOn: string[];

  exists: boolean;
  defaultBranch: string | Unknown;
  latestCommit: CommitSummary | Unknown;
  lastUpdatedAt: string | Unknown;

  openPullRequests: PullRequestSummary[];
  openIssues: IssueSummary[];
  ci: CiStatus;
  release: ReleaseSummary | null;
  distribution: DistributionStatus;

  capabilityContractPublished: EvidencedBoolean;
  providesPublished: EvidencedBoolean;
  osIntegration: {
    status: "integrated" | "integrated_as_gate" | "not_integrated" | Unknown;
    detail: string | Unknown;
    source: EvidenceSource;
  };
  verifiedEndToEnd: EvidencedBoolean;

  maturity: MaturityAssessment;

  fetchedAt: string;
  fetchErrors: string[];
}

export type BottleneckKind =
  | "ci_failing_default_branch"
  | "pr_merge_conflict"
  | "pr_stale_open"
  | "capability_not_declared"
  | "not_os_integrated"
  | "dependency_not_integrated";

export interface Bottleneck {
  kind: BottleneckKind;
  repoSlug: string;
  summary: string;
  evidenceUrl: string | Unknown;
  detectedAt: string;
}

export interface MaturityDistribution {
  /** count of repos at each level, indexed 0..6 */
  counts: [number, number, number, number, number, number, number];
  totalRepos: number;
}

export interface OsOverview {
  totalRepos: number;
  reposByType: Record<RepoType, number>;
  openPullRequestsTotal: number;
  openIssuesTotal: number;
  ciFailingCount: number;
  maturityDistribution: MaturityDistribution;
  recentlyChangedRepos: Array<{ slug: string; lastUpdatedAt: string }>;
}

export interface AgentStatus {
  slug: string;
  architecture: string | Unknown;
  architectureEvidence: string | Unknown;
  capabilityDiscovery: string | Unknown;
  capabilityDiscoveryEvidence: string | Unknown;
  skillIntegration: string | Unknown;
  skillIntegrationEvidence: string | Unknown;
  aiProvider: string | Unknown;
  aiProviderEvidence: string | Unknown;
  tests: { total: number; passing: number; note: string } | Unknown;
  verifiedEndToEnd: EvidencedBoolean;
}

export interface EcosystemGraphEdge {
  from: string; // slug
  to: string; // slug
  kind: "depends_on";
}

export interface EcosystemGraph {
  nodes: Array<{ slug: string; type: RepoType }>;
  edges: EcosystemGraphEdge[];
}

export interface EcosystemSnapshot {
  schemaVersion: 1;
  generatedAt: string; // ISO 8601
  generator: { name: string; version: string };
  authTokenPresent: boolean;
  rateLimit: { remaining: number | Unknown; limit: number | Unknown };

  overview: OsOverview;
  repos: RepoStatus[];
  agent: AgentStatus | null;
  bottlenecks: Bottleneck[];
  graph: EcosystemGraph;

  /** Repos listed in registry.json that could not be fetched at all (renamed, deleted,
   * private without access, etc.) -- surfaced explicitly, never silently dropped. */
  unreachableRepos: Array<{ slug: string; reason: string }>;
}
