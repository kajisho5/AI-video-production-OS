/**
 * The Ecosystem Control Room's canonical read model.
 *
 * This is NOT a second source of truth. Every field here is derived, at generation
 * time, from documents and APIs that already exist and are already authoritative:
 * docs/ROADMAP.md, docs/ecosystem/*.md, docs/ecosystem/registry.json,
 * docs/ecosystem/capability-status.json, the OS Dashboard's own generated
 * ecosystem-snapshot.json (live GitHub state), and -- optionally, if configured --
 * an on-disk System Intelligence snapshot directory. If a value cannot be derived
 * from one of those sources, it is UNKNOWN, never guessed or fabricated.
 *
 * "Do not force artificial hierarchy where the source does not support it" (the
 * task's own words): most Tasks below have `epic: Unknown` and `milestone: Unknown`
 * because docs/ecosystem/WORK_QUEUE.md has no Epic/Milestone concept -- inventing
 * one here would misrepresent the source, not summarize it.
 */
import type { Unknown } from "../../shared/types.js";
export type { Unknown } from "../../shared/types.js";
export { UNKNOWN } from "../../shared/types.js";

/** Where a piece of evidence for a claim in this read model came from. Never omit
 * this -- a Control Room that can't say *why* it believes something is worse than
 * one that says UNKNOWN. */
export interface Evidence {
  /** What kind of source this is. "doc" = a prose/markdown file in this repo,
   * "structured_file" = a JSON file this repo maintains (registry.json etc.),
   * "github_api" = a live API call, "generated_snapshot" = the OS Dashboard's own
   * already-generated ecosystem-snapshot.json, "si_snapshot" = a System
   * Intelligence snapshot directory, "inference" = computed by this generator
   * itself (e.g. next-executable-task) and MUST be labeled as such wherever shown. */
  source: "doc" | "structured_file" | "github_api" | "generated_snapshot" | "si_snapshot" | "inference";
  /** File path, URL, or API call this was drawn from. */
  locator: string;
  /** One-line human-readable description of what was found there. */
  detail: string;
}

/** The full status vocabulary used across the lifecycle. UNKNOWN is a first-class
 * value -- never converted into a guess. */
export type LifecycleStatus =
  | "PLANNED"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DRAFT_PR"
  | "CI"
  | "REVIEW"
  | "WAITING_APPROVAL"
  | "MERGED"
  | "VERIFIED"
  | "DONE"
  | "DEFERRED"
  | "UNKNOWN";

export interface Objective {
  /** Quoted (not paraphrased) from the repository's own README.md Mission/core-idea
   * section, so this is never an invented restatement of intent. */
  statement: string;
  evidence: Evidence;
}

export interface Phase {
  id: string; // e.g. "Phase 0", "Phase 4" -- exactly as docs/ROADMAP.md names it
  title: string;
  status: LifecycleStatus;
  /** The raw "**Status: ...**" line from ROADMAP.md, verbatim, so a human can see
   * exactly what the doc says even where this generator's LifecycleStatus mapping
   * simplifies it. */
  statusText: string;
  dependsOnPhaseIds: string[];
  evidence: Evidence[];
}

/** WORK_QUEUE.md has no Epic/Milestone level -- both fields are UNKNOWN for every
 * Task derived from it, per the "don't force artificial hierarchy" rule. */
export interface Task {
  id: string; // WORK_QUEUE.md's own item number, e.g. "8"
  title: string;
  source: "WORK_QUEUE.md";
  phaseId: string | Unknown; // only set when the item's own text names a specific Phase
  epic: Unknown;
  milestone: Unknown;
  status: LifecycleStatus;
  /** The raw heading-suffix text WORK_QUEUE.md itself uses (e.g. "DONE 2026-09-06",
   * "LIVE 2026-09-06, verified against the real deployed site"), or null when the
   * item carries no such marker (this generator does NOT invent one). */
  statusMarker: string | null;
  dependencies: string[]; // other Task ids this one's own text names as a dependency
  blockers: string[]; // free-text blocker descriptions, only when the doc states one
  pullRequests: PullRequestRef[];
  evidence: Evidence[];
  /** True only for the items detected as the queue's current recommended-next item
   * (see `nextExecutableTask` below) -- kept here too so a Task list view doesn't
   * need to cross-reference separately. */
  isRecommendedNext: boolean;
}

/** A pull request cited in a Task's own text, resolved against live GitHub state
 * where possible. `resolution` distinguishes a real API-confirmed fact from a
 * citation this generator could not resolve. */
export interface PullRequestRef {
  repoSlug: string;
  number: number;
  citedText: string; // the substring of the doc that mentioned this PR
  resolution: "resolved" | "not_found" | "unresolved_error" | "ambiguous_repo";
  state?: PullRequestState;
}

export interface PullRequestState {
  number: number;
  repoSlug: string;
  title: string;
  url: string;
  draft: boolean;
  merged: boolean;
  state: "open" | "closed";
  mergeableState: string | Unknown;
  ciConclusion: string | Unknown;
  evidence: Evidence;
}

export interface Dependency {
  fromSlug: string;
  toSlug: string;
  evidence: Evidence;
}

/** A concrete reason something cannot proceed right now, always with evidence --
 * never a guessed "this is probably blocked." */
export interface Blocker {
  id: string;
  description: string;
  affects: string[]; // Task ids and/or repo slugs
  evidence: Evidence[];
}

export interface RepositoryState {
  slug: string;
  name: string;
  type: "OS" | "Agent" | "Skill" | "Provider" | "Extension";
  role: string;
  dependsOn: string[];
  /** Pulled straight from the OS Dashboard's own generated ecosystem-snapshot.json
   * (per-repo RepoStatus) -- never re-derived here, to avoid a second, possibly
   * inconsistent computation of the same facts. Null when no snapshot was
   * available at generation time. */
  liveState: LiveRepoFacts | null;
  contractPublished: boolean | Unknown;
  providesPublished: boolean | Unknown;
  osIntegration: string | Unknown;
  verifiedEndToEnd: string | Unknown;
  evidence: Evidence[];
}

export interface LiveRepoFacts {
  defaultBranch: string | Unknown;
  openPullRequestCount: number;
  openIssueCount: number;
  ciConclusion: string | Unknown;
  maturityLevel: number | Unknown;
}

export interface VerificationRecord {
  id: string;
  subject: string; // what was verified (a Task id, a repo slug, free text)
  method: string; // e.g. "real end-to-end video-agent plan/render/QA run", "pytest suite"
  result: "PASS" | "FAIL" | "UNKNOWN";
  evidence: Evidence[];
}

/** Passed through from a System Intelligence snapshot (components.json/
 * findings.json) with no reinterpretation -- SI's own severity/confidence
 * vocabulary is preserved verbatim, never remapped into this project's own
 * enums, so nothing is lost or silently reinterpreted in translation. */
export interface IntelligenceFinding {
  id: string;
  category: string;
  severity: string;
  statement: string;
  confidence: string;
  affectedEntityIds: string[];
  evidence: Evidence[];
}

export interface IntelligenceRecommendation {
  id: string;
  objective: string;
  rationale: string;
  confidence: string;
}

/** A discrepancy between two sources this generator can both read, shown as
 * evidence -- never silently resolved in either source's favor. */
export interface RoadmapDrift {
  id: string;
  summary: string;
  sourceA: Evidence;
  sourceB: Evidence;
  detectedAt: string;
}

/** The single "what should happen next" answer, always explicitly labeled as a
 * recommendation, never presented as settled fact (per the task's own
 * instruction: "If the 'next task' is derived by inference, explicitly label it
 * as a recommendation rather than a verified fact"). */
export interface NextExecutableTaskRecommendation {
  taskId: string;
  reason: string;
  dependencies: string[];
  blockers: string[];
  repositorySlug: string | Unknown;
  evidence: Evidence[];
  isInference: true;
}

export interface SystemIntelligenceStatus {
  available: boolean;
  snapshotDirectory: string | null;
  reason: string; // why unavailable, or a one-line summary of what was loaded
  findings: IntelligenceFinding[];
  recommendations: IntelligenceRecommendation[];
  /** These two are named explicitly (rather than omitted) so the UI can show
   * "0 -- because Research/Verification are not yet implemented upstream", which
   * is itself real, useful information, not a fake zero. */
  researchCount: number;
  verificationCount: number;
}

export interface ControlRoomSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  generator: { name: string; version: string };
  objective: Objective;
  phases: Phase[];
  tasks: Task[];
  repositories: RepositoryState[];
  dependencies: Dependency[];
  blockers: Blocker[];
  nextExecutableTask: NextExecutableTaskRecommendation | null;
  verification: VerificationRecord[];
  systemIntelligence: SystemIntelligenceStatus;
  roadmapDrift: RoadmapDrift[];
  /** Repos docs/ecosystem/registry.json names that the OS Dashboard's own
   * ecosystem-snapshot.json could not reach (mirrors its own unreachableRepos so
   * the Control Room's repository list explains gaps rather than hiding them). */
  unreachableRepos: Array<{ slug: string; reason: string }>;
}

export const NO_ECOSYSTEM_SNAPSHOT_EVIDENCE: Evidence = {
  source: "generated_snapshot",
  locator: "dashboard/web/public/data/ecosystem-snapshot.json",
  detail: "not found at generation time -- run dashboard/aggregator first for live per-repo GitHub facts",
};

export function unknownEvidence(locator: string, detail: string): Evidence {
  return { source: "inference", locator, detail };
}
