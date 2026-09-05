import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewPanel } from "./OverviewPanel.js";
import type { OsOverview } from "@ecosystem/types";

function overview(overrides: Partial<OsOverview> = {}): OsOverview {
  return {
    totalRepos: 12,
    reposByType: { OS: 1, Agent: 1, Skill: 10, Provider: 0, Extension: 0 },
    openPullRequestsTotal: 4,
    openIssuesTotal: 0,
    ciFailingCount: 0,
    maturityDistribution: { counts: [0, 0, 2, 4, 4, 0, 0], totalRepos: 10 },
    recentlyChangedRepos: [],
    ...overrides,
  };
}

describe("OverviewPanel", () => {
  it("renders real counts, never a composite percentage", () => {
    render(<OverviewPanel overview={overview()} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders every maturity level even when its count is zero, never omitting a level", () => {
    render(<OverviewPanel overview={overview()} />);
    expect(screen.getByText(/0\. Proposed/)).toBeInTheDocument();
    expect(screen.getByText(/6\. Distributed/)).toBeInTheDocument();
  });

  it("does not crash when maturityDistribution.totalRepos is 0 (all counts zero)", () => {
    render(<OverviewPanel overview={overview({ maturityDistribution: { counts: [0, 0, 0, 0, 0, 0, 0], totalRepos: 0 } })} />);
    expect(screen.getByText(/0 Skill\/Provider\/Extension repos/)).toBeInTheDocument();
  });
});
