import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App.js";
import type { EcosystemSnapshot } from "@ecosystem/types";

function minimalSnapshot(overrides: Partial<EcosystemSnapshot> = {}): EcosystemSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-09-05T21:00:00Z",
    generator: { name: "ecosystem-dashboard-aggregator", version: "0.1.0" },
    authTokenPresent: true,
    rateLimit: { remaining: 4990, limit: 5000 },
    overview: {
      totalRepos: 1,
      reposByType: { OS: 1, Agent: 0, Skill: 0, Provider: 0, Extension: 0 },
      openPullRequestsTotal: 0,
      openIssuesTotal: 0,
      ciFailingCount: 0,
      maturityDistribution: { counts: [0, 0, 0, 0, 0, 0, 0], totalRepos: 0 },
      recentlyChangedRepos: [],
    },
    repos: [],
    agent: null,
    bottlenecks: [],
    graph: { nodes: [], edges: [] },
    unreachableRepos: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows a loading state before the snapshot arrives", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // never resolves
    render(<App />);
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it("renders the overview once the snapshot loads, calling fetch exactly once against the static JSON path (never GitHub)", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(minimalSnapshot()), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => expect(screen.getByText(/認証あり/)).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("data/ecosystem-snapshot.json");
    expect(calledUrl).not.toContain("api.github.com");
  });

  it("shows an explicit error banner, not a blank screen, when the snapshot fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("not found", { status: 404 }))));

    render(<App />);

    await waitFor(() => expect(screen.getByText(/読み込めませんでした/)).toBeInTheDocument());
  });

  it("surfaces unreachable repos explicitly rather than silently dropping them", async () => {
    const snapshot = minimalSnapshot({ unreachableRepos: [{ slug: "kajisho5/renamed-skill", reason: "repos.get failed: 404" }] });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<App />);

    await waitFor(() => expect(screen.getByText(/到達できませんでした/)).toBeInTheDocument());
    expect(screen.getByText("kajisho5/renamed-skill")).toBeInTheDocument();
  });
});
