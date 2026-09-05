/**
 * Thin wrapper over @octokit/rest for exactly the read-only calls this aggregator
 * needs. This is the ONLY module in this project that makes GitHub API calls, and it
 * only ever runs server-side (inside GitHub Actions or a developer's own machine),
 * never in the browser (ADR-011). No write endpoint is ever called from here.
 */
import { Octokit } from "@octokit/rest";
import type {
  CiStatus,
  CommitSummary,
  IssueSummary,
  PullRequestSummary,
  ReleaseSummary,
  Unknown,
} from "../../shared/types.js";
import { UNKNOWN } from "../../shared/types.js";

export function makeOctokit(token: string | undefined): Octokit {
  return new Octokit(token ? { auth: token } : {});
}

export interface RepoGithubFacts {
  exists: boolean;
  defaultBranch: string | Unknown;
  latestCommit: CommitSummary | Unknown;
  lastUpdatedAt: string | Unknown;
  openPullRequests: PullRequestSummary[];
  openIssues: IssueSummary[];
  ci: CiStatus;
  release: ReleaseSummary | null;
  fetchErrors: string[];
  /** repos.get's `size` field (KB), used only as MATURITY_MODEL.md level 1's cheap
   * automatic non-empty-repo signal -- deliberately not a general-purpose repo-size
   * metric. */
  sizeKb: number | undefined;
}

const STALE_PR_DAYS = 14;
const MAX_MERGEABILITY_CHECKS_PER_REPO = 8;

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/** Fetches everything this aggregator needs about one repository. Never throws for an
 * individual sub-fetch failure (a missing releases page, e.g., is common and not an
 * error) -- failures are collected into `fetchErrors` and the corresponding field
 * becomes UNKNOWN, per this project's "UNKNOWN over guessing" rule. */
export async function fetchRepoFacts(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoGithubFacts> {
  const fetchErrors: string[] = [];

  let repoData;
  try {
    const res = await octokit.repos.get({ owner, repo });
    repoData = res.data;
  } catch (err) {
    return {
      exists: false,
      defaultBranch: UNKNOWN,
      latestCommit: UNKNOWN,
      lastUpdatedAt: UNKNOWN,
      openPullRequests: [],
      openIssues: [],
      ci: { conclusion: UNKNOWN, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN },
      release: null,
      fetchErrors: [`repos.get failed: ${(err as Error).message}`],
      sizeKb: undefined,
    };
  }

  const defaultBranch = repoData.default_branch;

  let latestCommit: CommitSummary | Unknown = UNKNOWN;
  try {
    const res = await octokit.repos.listCommits({ owner, repo, sha: defaultBranch, per_page: 1 });
    const c = res.data[0];
    if (c) {
      latestCommit = {
        sha: c.sha,
        message: c.commit.message.split("\n")[0] ?? "",
        author: c.commit.author?.name ?? UNKNOWN,
        date: c.commit.author?.date ?? UNKNOWN,
        url: c.html_url,
      };
    }
  } catch (err) {
    fetchErrors.push(`listCommits failed: ${(err as Error).message}`);
  }

  let openPullRequests: PullRequestSummary[] = [];
  try {
    const res = await octokit.pulls.list({ owner, repo, state: "open", per_page: 50 });
    openPullRequests = res.data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      draft: pr.draft ?? false,
      mergeableState: UNKNOWN, // pulls.list does not include mergeable_state; filled in below for a bounded number of PRs
      updatedAt: pr.updated_at,
      isStale: daysSince(pr.updated_at) > STALE_PR_DAYS,
    }));
    // mergeable_state is only present on the single-PR endpoint, and GitHub computes it
    // asynchronously (a fresh PR may briefly report "unknown"). Bounded to the first
    // MAX_MERGEABILITY_CHECKS PRs per repo so this doesn't multiply the aggregator's
    // GitHub API call count unboundedly on a repo with many open PRs.
    const toEnrich = openPullRequests.slice(0, MAX_MERGEABILITY_CHECKS_PER_REPO);
    for (const pr of toEnrich) {
      try {
        const single = await octokit.pulls.get({ owner, repo, pull_number: pr.number });
        pr.mergeableState = single.data.mergeable_state ?? UNKNOWN;
      } catch (err) {
        fetchErrors.push(`pulls.get(#${pr.number}) failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    fetchErrors.push(`pulls.list failed: ${(err as Error).message}`);
  }

  let openIssues: IssueSummary[] = [];
  try {
    const res = await octokit.issues.listForRepo({ owner, repo, state: "open", per_page: 50 });
    // GitHub's issues.listForRepo also returns PRs; exclude them since they're already covered above.
    openIssues = res.data
      .filter((i) => !("pull_request" in i))
      .map((i) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        updatedAt: i.updated_at,
        labels: (i.labels ?? []).map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean),
      }));
  } catch (err) {
    fetchErrors.push(`issues.listForRepo failed: ${(err as Error).message}`);
  }

  let ci: CiStatus = { conclusion: UNKNOWN, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN };
  try {
    const res = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch: defaultBranch,
      per_page: 1,
    });
    const run = res.data.workflow_runs[0];
    if (run) {
      ci = {
        conclusion: (run.conclusion as CiStatus["conclusion"]) ?? (run.status === "in_progress" ? "in_progress" : UNKNOWN),
        workflowName: run.name ?? UNKNOWN,
        runUrl: run.html_url,
        updatedAt: run.updated_at,
      };
    } else {
      ci = { conclusion: UNKNOWN, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN };
      fetchErrors.push("no workflow runs found on default branch (no CI configured, or none has run)");
    }
  } catch (err) {
    fetchErrors.push(`actions.listWorkflowRunsForRepo failed: ${(err as Error).message}`);
  }

  let release: ReleaseSummary | null = null;
  try {
    const res = await octokit.repos.getLatestRelease({ owner, repo });
    release = {
      tagName: res.data.tag_name,
      publishedAt: res.data.published_at ?? UNKNOWN,
      url: res.data.html_url,
    };
  } catch {
    release = null; // absence of any release is a normal, common state, not an error worth recording
  }

  return {
    exists: true,
    defaultBranch,
    latestCommit,
    lastUpdatedAt: repoData.pushed_at ?? UNKNOWN,
    openPullRequests,
    openIssues,
    ci,
    release,
    fetchErrors,
    sizeKb: repoData.size,
  };
}

export async function fetchRateLimit(octokit: Octokit): Promise<{ remaining: number | Unknown; limit: number | Unknown }> {
  try {
    const res = await octokit.rateLimit.get();
    return { remaining: res.data.resources.core.remaining, limit: res.data.resources.core.limit };
  } catch {
    return { remaining: UNKNOWN, limit: UNKNOWN };
  }
}
