import { describe, expect, it } from "vitest";
import { fetchRepoFacts } from "../src/github.js";
import type { Octokit } from "@octokit/rest";
import { UNKNOWN } from "../../shared/types.js";

/** A fake Octokit implementing exactly the calls fetchRepoFacts makes, shaped like
 * real ffmpeg-skill#24 facts (verified live via the GitHub MCP tool on 2026-09-05) so
 * this test doubles as a realistic fixture, not just an arbitrary mock. */
function fakeOctokit(overrides: Partial<Record<string, any>> = {}): Octokit {
  return {
    repos: {
      get: async () => ({ data: { default_branch: "main", pushed_at: "2026-09-05T21:03:59Z", size: 4200 } }),
      listCommits: async () => ({ data: [{ sha: "26e172b", commit: { message: "Add provides\n\nlonger body", author: { name: "kajisho5", date: "2026-09-05T20:22:41Z" } }, html_url: "https://github.com/kajisho5/ffmpeg-skill/commit/26e172b" }] }),
      getLatestRelease: async () => { throw new Error("404 Not Found"); },
      ...overrides.repos,
    },
    pulls: {
      list: async () => ({
        data: [
          { number: 24, title: "Add provides: publish Capability ids for cross-repository discovery", html_url: "https://github.com/kajisho5/ffmpeg-skill/pull/24", draft: true, updated_at: "2026-09-05T21:03:59Z" },
        ],
      }),
      get: async () => ({ data: { mergeable_state: "clean" } }),
      ...overrides.pulls,
    },
    issues: {
      listForRepo: async () => ({ data: [] }),
      ...overrides.issues,
    },
    actions: {
      listWorkflowRunsForRepo: async () => ({
        data: { workflow_runs: [{ conclusion: "success", status: "completed", name: "test", html_url: "https://github.com/kajisho5/ffmpeg-skill/actions/runs/1", updated_at: "2026-09-05T21:13:21Z" }] },
      }),
      ...overrides.actions,
    },
    rateLimit: {
      get: async () => ({ data: { resources: { core: { remaining: 4999, limit: 5000 } } } }),
      ...overrides.rateLimit,
    },
  } as unknown as Octokit;
}

describe("fetchRepoFacts", () => {
  it("assembles a full RepoGithubFacts object from a healthy repo (shaped like real ffmpeg-skill#24 data)", async () => {
    const facts = await fetchRepoFacts(fakeOctokit(), "kajisho5", "ffmpeg-skill");
    expect(facts.exists).toBe(true);
    expect(facts.defaultBranch).toBe("main");
    expect(facts.ci.conclusion).toBe("success");
    expect(facts.openPullRequests).toHaveLength(1);
    expect(facts.openPullRequests[0].mergeableState).toBe("clean"); // enriched via pulls.get
    expect(facts.release).toBeNull(); // no release exists, not an error
    expect(facts.fetchErrors).toEqual([]);
    expect(facts.sizeKb).toBe(4200);
  });

  it("returns exists:false with a fetchError when the repo itself cannot be fetched, never throwing", async () => {
    const octokit = fakeOctokit({ repos: { get: async () => { throw new Error("404 Not Found"); } } });
    const facts = await fetchRepoFacts(octokit, "kajisho5", "does-not-exist");
    expect(facts.exists).toBe(false);
    expect(facts.fetchErrors[0]).toMatch(/404/);
  });

  it("degrades one field to UNKNOWN and records the error, without failing the whole fetch, when a sub-call fails", async () => {
    const octokit = fakeOctokit({ actions: { listWorkflowRunsForRepo: async () => { throw new Error("rate limited"); } } });
    const facts = await fetchRepoFacts(octokit, "kajisho5", "ffmpeg-skill");
    expect(facts.exists).toBe(true); // the rest of the fetch still succeeds
    expect(facts.ci.conclusion).toBe(UNKNOWN);
    expect(facts.fetchErrors.some((e) => e.includes("rate limited"))).toBe(true);
  });

  it("reports UNKNOWN CI with a fetchError when no workflow runs exist on the default branch", async () => {
    const octokit = fakeOctokit({ actions: { listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [] } }) } });
    const facts = await fetchRepoFacts(octokit, "kajisho5", "AI-video-production-OS");
    expect(facts.ci.conclusion).toBe(UNKNOWN);
    expect(facts.fetchErrors.some((e) => e.includes("no workflow runs"))).toBe(true);
  });

  it("excludes pull requests from the issues list (GitHub's issues.listForRepo also returns PRs)", async () => {
    const octokit = fakeOctokit({
      issues: {
        listForRepo: async () => ({
          data: [
            { number: 1, title: "a real issue", html_url: "u1", updated_at: "t", labels: [] },
            { number: 2, title: "actually a PR", html_url: "u2", updated_at: "t", labels: [], pull_request: {} },
          ],
        }),
      },
    });
    const facts = await fetchRepoFacts(octokit, "kajisho5", "x");
    expect(facts.openIssues).toHaveLength(1);
    expect(facts.openIssues[0].number).toBe(1);
  });
});
