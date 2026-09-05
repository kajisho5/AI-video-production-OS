import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepoList } from "./RepoList.js";
import type { RepoStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";

function repo(overrides: Partial<RepoStatus> = {}): RepoStatus {
  return {
    slug: "kajisho5/example-skill",
    name: "example-skill",
    type: "Skill",
    role: "an example role",
    dependsOn: [],
    exists: true,
    defaultBranch: "main",
    latestCommit: UNKNOWN,
    lastUpdatedAt: "2026-09-05T12:00:00Z",
    openPullRequests: [],
    openIssues: [],
    ci: { conclusion: "success", workflowName: "tests", runUrl: "https://x", updatedAt: "t" },
    release: null,
    distribution: { kind: UNKNOWN, package: null, latestVersion: UNKNOWN },
    capabilityContractPublished: { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN },
    providesPublished: { value: true, source: "documented", detail: "test" },
    osIntegration: { status: "integrated", detail: "test", source: "documented" },
    verifiedEndToEnd: { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN },
    maturity: { level: 3, evidence: [] },
    fetchedAt: "t",
    fetchErrors: [],
    ...overrides,
  };
}

describe("RepoList", () => {
  it("renders every repo's name", () => {
    render(<RepoList repos={[repo(), repo({ slug: "kajisho5/other-skill", name: "other-skill" })]} />);
    expect(screen.getAllByText("example-skill").length).toBeGreaterThan(0);
    expect(screen.getAllByText("other-skill").length).toBeGreaterThan(0);
  });

  it("renders UNKNOWN CI distinctly, never as if it were failing or passing", () => {
    render(<RepoList repos={[repo({ ci: { conclusion: UNKNOWN, workflowName: UNKNOWN, runUrl: UNKNOWN, updatedAt: UNKNOWN } })]} />);
    const chips = screen.getAllByText(/CI 不明/);
    expect(chips.length).toBeGreaterThan(0);
  });

  it("renders 'provides: なし' distinctly from 不明 when the fact is actually documented as false", () => {
    render(<RepoList repos={[repo({ providesPublished: { value: false, source: "documented", detail: "PR still open" } })]} />);
    expect(screen.getAllByText(/provides: なし/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/provides: 不明/)).toBeNull();
  });

  it("does not render a provides chip for non-Skill repo types", () => {
    render(<RepoList repos={[repo({ type: "OS", name: "AI-video-production-OS" })]} />);
    expect(screen.queryByText(/provides:/)).toBeNull();
  });

  it("flags a PR with a real merge conflict visibly", () => {
    render(
      <RepoList
        repos={[
          repo({
            openPullRequests: [{ number: 24, title: "Add provides", url: "https://x", draft: true, mergeableState: "dirty", updatedAt: "t", isStale: false }],
          }),
        ]}
      />,
    );
    expect(screen.getAllByText("競合あり").length).toBeGreaterThan(0);
  });
});
