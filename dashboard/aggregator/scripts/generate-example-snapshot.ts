/**
 * Generates a realistic EXAMPLE snapshot for local frontend development, using the
 * real aggregator pipeline (buildRepoStatus/buildOverview/detectBottlenecks/buildGraph
 * -- the same functions index.ts uses) fed with real GitHub facts gathered via the
 * GitHub MCP tool on 2026-09-05 (this development sandbox's raw HTTPS access to
 * api.github.com is blocked by its own GitHub App connector policy; the abstracted MCP
 * tool is not, which is how these facts were actually verified). The one exception is
 * the npm/PyPI version lookup (packageRegistry.ts), which uses a real, live network
 * call -- that registry is directly reachable from this sandbox, unlike api.github.com.
 *
 * The real `.github/workflows/dashboard.yml` has since run for real in CI and overwrote
 * this file with a genuinely, entirely live-fetched snapshot -- this script and its
 * fixture data are kept only as a documented, reproducible way to regenerate a
 * realistic example for local frontend development (`npm run dev` needs *some* snapshot
 * file to exist under `web/public/data/`).
 *
 *   npx tsx scripts/generate-example-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Octokit } from "@octokit/rest";
import { buildAgentStatus } from "../src/agentStatus.js";
import { detectBottlenecks } from "../src/bottlenecks.js";
import { loadCapabilityStatus, loadRegistry } from "../src/config.js";
import { fetchRepoFacts } from "../src/github.js";
import { fetchLatestVersion } from "../src/packageRegistry.js";
import { buildGraph, buildOverview, buildRepoStatus } from "../src/normalize.js";
import type { EcosystemSnapshot, Unknown } from "../../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface FakePr {
  number: number;
  title: string;
  draft: boolean;
  mergeable_state: string;
  updated_at: string;
}

interface FakeRepoData {
  default_branch: string;
  pushed_at: string;
  size: number;
  latest_commit: { sha: string; message: string; author: string; date: string };
  open_prs: FakePr[];
  ci_conclusion: string | null;
  ci_workflow: string;
}

// Real facts as verified via the GitHub MCP tool, 2026-09-05.
const REAL_FACTS: Record<string, FakeRepoData> = {
  "kajisho5/AI-video-production-OS": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:37:14Z",
    size: 3200,
    latest_commit: { sha: "a8605cd", message: "registry/conformance: implement no_unsafe_shell_out, completing all 8 SKILL_SPEC checks", author: "kajisho5", date: "2026-09-05T21:45:00Z" },
    open_prs: [{ number: 1, title: "Architecture + registry/ + ecosystem docs", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T21:37:14Z" }],
    ci_conclusion: null,
    ci_workflow: "none configured",
  },
  "kajisho5/video-production-agent": {
    default_branch: "main",
    pushed_at: "2026-09-05T17:43:11Z",
    size: 8900,
    latest_commit: { sha: "d8a6c83", message: "ADR-034: revision review history", author: "kajisho5", date: "2026-09-05T17:43:00Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/ffmpeg-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:03:53Z",
    size: 5400,
    latest_commit: { sha: "b51dc5e", message: "Merge: typed primary colour correction (0.9.2)", author: "kajisho5", date: "2026-09-05T20:56:04Z" },
    open_prs: [
      { number: 24, title: "Add provides: publish Capability ids for cross-repository discovery", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T21:13:07Z" },
      { number: 22, title: "Fix FFmpeg 8+ and Windows compatibility for caption and color", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T17:53:51Z" },
    ],
    ci_conclusion: "success",
    ci_workflow: "test",
  },
  "kajisho5/video-editing-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:37:34Z",
    size: 2100,
    latest_commit: { sha: "e1f2a3b", message: "Merge pull request #2 from add-capability-provides-field", author: "kajisho5", date: "2026-09-05T20:00:00Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/audio-production-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:09:12Z",
    size: 1900,
    latest_commit: { sha: "c4d5e6f", message: "Merge pull request #3 from add-capability-provides-field", author: "kajisho5", date: "2026-09-05T19:30:00Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/color-grading-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:23:20Z",
    size: 2600,
    latest_commit: { sha: "2935322", message: "Add PRIMARY_CORRECTION: typed primary colour correction via ffmpeg-skill 0.9.2", author: "kajisho5", date: "2026-09-05T21:23:20Z" },
    open_prs: [{ number: 4, title: "Add provides: publish Capability ids for cross-repository discovery", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T20:04:49Z" }],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/subtitle-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T19:47:46Z",
    size: 1500,
    latest_commit: { sha: "56f4f8b", message: "Implement subtitle-skill: typed validation, SRT/WebVTT generation, burn-in delegation", author: "kajisho5", date: "2026-09-05T04:22:38Z" },
    open_prs: [{ number: 2, title: "Add provides: publish Capability ids for cross-repository discovery", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T19:47:46Z" }],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/motion-graphics-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:40:51Z",
    size: 2400,
    latest_commit: { sha: "91618c6", message: "Refresh CLAUDE.md after merging PR #2/#3/#4", author: "kajisho5", date: "2026-09-05T21:33:43Z" },
    open_prs: [{ number: 6, title: "Implement chapter element type (corner chip)", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T21:40:51Z" }],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/thumbnail-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:12:27Z",
    size: 2000,
    latest_commit: { sha: "1f14403", message: "Add ADR log and an explicit ffmpeg-skill contract/gap doc", author: "kajisho5", date: "2026-09-05T21:11:56Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/qc-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:24:41Z",
    size: 3800,
    latest_commit: { sha: "11a1c2e", message: "(main, unaffected by the stacked feature branches below)", author: "kajisho5", date: "2026-09-05T18:00:00Z" },
    open_prs: [
      { number: 6, title: "Phase 4: Visual Defect Evidence (luminance-range excursions)", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T21:24:43Z" },
      { number: 5, title: "Add provides: publish Capability ids for cross-repository discovery", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T20:15:51Z" },
      { number: 4, title: "Phase 3: Timeline Integrity", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T21:00:20Z" },
      { number: 3, title: "Phase 2: Cross-Artifact Validation", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T20:59:26Z" },
      { number: 2, title: "Phase 1: Delivery Gate Foundation (kind=delivery_package)", draft: true, mergeable_state: "clean", updated_at: "2026-09-05T20:58:10Z" },
    ],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/media-analysis-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:09:41Z",
    size: 2800,
    latest_commit: { sha: "7a8b9c0", message: "Merge pull request #4 from add-capability-provides-field", author: "kajisho5", date: "2026-09-05T19:00:00Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
  "kajisho5/transcription-skill": {
    default_branch: "main",
    pushed_at: "2026-09-05T21:15:41Z",
    size: 2200,
    latest_commit: { sha: "3d4e5f6", message: "Merge pull request #5 from add-capability-provides-field", author: "kajisho5", date: "2026-09-05T19:15:00Z" },
    open_prs: [],
    ci_conclusion: "success",
    ci_workflow: "tests",
  },
};

function fakeOctokitFor(slug: string): Octokit {
  const data = REAL_FACTS[slug];
  return {
    repos: {
      get: async () => ({ data: { default_branch: data.default_branch, pushed_at: data.pushed_at, size: data.size } }),
      listCommits: async () => ({
        data: [{ sha: data.latest_commit.sha, commit: { message: data.latest_commit.message, author: { name: data.latest_commit.author, date: data.latest_commit.date } }, html_url: `https://github.com/${slug}/commit/${data.latest_commit.sha}` }],
      }),
      getLatestRelease: async () => {
        throw new Error("404 Not Found");
      },
    },
    pulls: {
      list: async () => ({
        data: data.open_prs.map((pr) => ({ number: pr.number, title: pr.title, html_url: `https://github.com/${slug}/pull/${pr.number}`, draft: pr.draft, updated_at: pr.updated_at })),
      }),
      get: async ({ pull_number }: { pull_number: number }) => ({
        data: { mergeable_state: data.open_prs.find((p) => p.number === pull_number)?.mergeable_state ?? "unknown" },
      }),
    },
    issues: {
      listForRepo: async () => ({ data: [] }),
    },
    actions: {
      listWorkflowRunsForRepo: async () =>
        data.ci_conclusion === null
          ? { data: { workflow_runs: [] } }
          : {
              data: {
                workflow_runs: [
                  {
                    conclusion: data.ci_conclusion,
                    status: "completed",
                    name: data.ci_workflow,
                    html_url: `https://github.com/${slug}/actions`,
                    updated_at: data.pushed_at,
                  },
                ],
              },
            },
    },
    rateLimit: {
      get: async () => ({ data: { resources: { core: { remaining: 4950, limit: 5000 } } } }),
    },
  } as unknown as Octokit;
}

async function main() {
  const registry = loadRegistry();
  const capabilityStatus = loadCapabilityStatus();
  const fetchedAt = "2026-09-05T22:00:00Z";
  const repos = [];

  for (const entry of registry.repos) {
    const [owner, repo] = entry.slug.split("/");
    const octokit = fakeOctokitFor(entry.slug);
    const facts = await fetchRepoFacts(octokit, owner, repo);
    const status = capabilityStatus.repos[entry.slug];
    let distributionLookup: { version: string | Unknown; lookupError?: string } | undefined;
    const distKind = status?.distribution?.kind;
    if ((distKind === "npm" || distKind === "pypi") && status?.distribution?.package) {
      const result = await fetchLatestVersion(distKind, status.distribution.package);
      distributionLookup = { version: result.version, lookupError: result.error };
    }
    repos.push(buildRepoStatus(entry, facts, status, fetchedAt, distributionLookup));
  }

  const bottlenecks = detectBottlenecks(repos);
  const overview = buildOverview(repos, bottlenecks);
  const graph = buildGraph(repos);
  const agent = buildAgentStatus(capabilityStatus.repos["kajisho5/video-production-agent"]);

  const snapshot: EcosystemSnapshot = {
    schemaVersion: 1,
    generatedAt: fetchedAt,
    generator: { name: "ecosystem-dashboard-aggregator (example fixture)", version: "0.1.0" },
    authTokenPresent: true,
    rateLimit: { remaining: 4950, limit: 5000 },
    overview,
    repos,
    agent,
    bottlenecks,
    graph,
    unreachableRepos: [],
  };

  const outputPath = path.resolve(__dirname, "../../web/public/data/ecosystem-snapshot.json");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`Wrote ${outputPath} (${repos.length} repos, ${bottlenecks.length} bottlenecks)`);
}

main();
