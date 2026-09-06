/**
 * Two distinct GitHub-facing responsibilities, kept separate on purpose:
 *
 * 1. `loadEcosystemSnapshot` reads the OS Dashboard aggregator's OWN already-generated
 *    ecosystem-snapshot.json for per-repo facts (open PR/issue counts, CI conclusion,
 *    maturity level). This Control Room never re-fetches or re-computes those facts --
 *    doing so would risk a second, possibly-inconsistent answer to the same question
 *    the OS Dashboard already answers.
 *
 * 2. `resolvePullRequestCitations` makes its OWN, narrow, additional live API calls --
 *    one `pulls.get` per (repo, PR number) pair that WORK_QUEUE.md's text actually
 *    cites -- because those specific PRs (often merged/closed by now) are not
 *    necessarily present in the OS Dashboard snapshot's `openPullRequests` list at
 *    all. This is a deterministic fact lookup ("does PR #28 exist, is it draft, is it
 *    merged"), never an LLM guess, per the task's own instruction (section 13).
 */
import { readFileSync } from "node:fs";
import { Octokit } from "@octokit/rest";
import type { EcosystemSnapshot } from "../../../shared/types.js";
import type { PullRequestRef, PullRequestState } from "../types.js";

export function loadEcosystemSnapshot(filePath: string): EcosystemSnapshot | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as EcosystemSnapshot;
  } catch {
    return null;
  }
}

export function makeOctokit(token: string | undefined): Octokit {
  return new Octokit(token ? { auth: token } : {});
}

/** Resolves every (repoSlug, number) pair actually cited by name (never the
 * "ambiguous_repo"/UNKNOWN-repo ones, which cannot be looked up at all) against
 * live GitHub state, one `pulls.get` call each. Never throws for an individual
 * failure -- a 404 becomes `resolution: "not_found"`, kept as real information
 * rather than dropped. */
export async function resolvePullRequestCitations(
  octokit: Octokit,
  citations: Array<{ repoSlug: string; number: number; citedText: string }>,
): Promise<Array<PullRequestRef & { state?: PullRequestState }>> {
  const out: Array<PullRequestRef & { state?: PullRequestState }> = [];
  for (const c of citations) {
    if (c.repoSlug === "UNKNOWN") {
      out.push({ ...c, resolution: "ambiguous_repo" });
      continue;
    }
    const owner = "kajisho5";
    try {
      const { data } = await octokit.pulls.get({ owner, repo: c.repoSlug, pull_number: c.number });
      const state: PullRequestState = {
        number: data.number,
        repoSlug: c.repoSlug,
        title: data.title,
        url: data.html_url,
        draft: Boolean(data.draft),
        merged: Boolean(data.merged),
        state: data.state as "open" | "closed",
        mergeableState: data.mergeable_state ?? "UNKNOWN",
        ciConclusion: "UNKNOWN", // a per-PR check-run lookup would be a second call per PR; deliberately out of Phase 1 scope
        evidence: { source: "github_api", locator: `https://github.com/kajisho5/${c.repoSlug}/pull/${c.number}`, detail: "pulls.get" },
      };
      out.push({ ...c, resolution: "resolved", state });
    } catch (err: unknown) {
      const status = (err as { status?: number } | null)?.status;
      out.push({ ...c, resolution: status === 404 ? "not_found" : "unresolved_error" });
    }
  }
  return out;
}
