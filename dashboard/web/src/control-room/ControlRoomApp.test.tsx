import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ControlRoomApp from "./ControlRoomApp.js";
import type { ControlRoomSnapshot } from "@ecosystem/control-room-types";

function minimalSnapshot(overrides: Partial<ControlRoomSnapshot> = {}): ControlRoomSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-09-06T00:00:00Z",
    generator: { name: "ecosystem-control-room", version: "0.1.0" },
    objective: { statement: "Test objective.", evidence: { source: "doc", locator: "README.md", detail: "extracted" } },
    phases: [],
    tasks: [],
    repositories: [],
    dependencies: [],
    blockers: [],
    nextExecutableTask: null,
    verification: [],
    systemIntelligence: { available: false, snapshotDirectory: null, reason: "not configured", findings: [], recommendations: [], researchCount: 0, verificationCount: 0 },
    roadmapDrift: [],
    unreachableRepos: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ControlRoomApp", () => {
  it("shows a loading state before the snapshot arrives", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<ControlRoomApp />);
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it("renders the objective once the snapshot loads, fetching only the control-room JSON", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(minimalSnapshot()), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText("Test objective.")).toBeInTheDocument());
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("data/control-room-snapshot.json");
    expect(calledUrl).not.toContain("api.github.com");
  });

  it("shows an explicit error banner, not a blank screen, when the snapshot fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("not found", { status: 404 }))));
    render(<ControlRoomApp />);
    await waitFor(() => expect(screen.getByText(/読み込めませんでした/)).toBeInTheDocument());
  });

  it("shows a pre-PR task as ready/planned work, never as 'nothing happening'", async () => {
    const snapshot = minimalSnapshot({
      tasks: [
        {
          id: "1",
          title: "Investigate something",
          source: "WORK_QUEUE.md",
          phaseId: "UNKNOWN",
          epic: "UNKNOWN",
          milestone: "UNKNOWN",
          status: "UNKNOWN",
          statusMarker: null,
          dependencies: [],
          blockers: [],
          pullRequests: [],
          evidence: [{ source: "doc", locator: "docs/ecosystem/WORK_QUEUE.md#item-1", detail: "heading" }],
          isRecommendedNext: true,
        },
      ],
      nextExecutableTask: { taskId: "1", reason: "Recommendation, not a verified fact: first pre-PR item.", dependencies: [], blockers: [], repositorySlug: "UNKNOWN", evidence: [{ source: "doc", locator: "docs/ecosystem/WORK_QUEUE.md#item-1", detail: "heading" }], isInference: true },
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText(/Investigate something/)).toBeInTheDocument());
    expect(screen.getByText(/PR未作成/)).toBeInTheDocument();
    expect(screen.getAllByText(/推奨/).length).toBeGreaterThan(0);
    expect(screen.getByText(/確定した事実ではありません/)).toBeInTheDocument();
  });

  it("shows a task with an open PR under active work, distinct from pre-PR work", async () => {
    const snapshot = minimalSnapshot({
      tasks: [
        {
          id: "8",
          title: "Diagnostic tool",
          source: "WORK_QUEUE.md",
          phaseId: "UNKNOWN",
          epic: "UNKNOWN",
          milestone: "UNKNOWN",
          status: "DRAFT_PR",
          statusMarker: "IMPLEMENTED 2026-09-06 (Draft PR open)",
          dependencies: [],
          blockers: [],
          pullRequests: [{ repoSlug: "video-production-agent", number: 27, citedText: "video-production-agent#27", resolution: "resolved", state: { number: 27, repoSlug: "video-production-agent", title: "x", url: "https://github.com/kajisho5/video-production-agent/pull/27", draft: true, merged: false, state: "open", mergeableState: "UNKNOWN", ciConclusion: "UNKNOWN", evidence: { source: "github_api", locator: "x", detail: "pulls.get" } } }],
          evidence: [{ source: "doc", locator: "docs/ecosystem/WORK_QUEUE.md#item-8", detail: "heading" }],
          isRecommendedNext: false,
        },
      ],
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText(/Diagnostic tool/)).toBeInTheDocument());
    expect(screen.getByText(/video-production-agent#27/)).toBeInTheDocument();
  });

  it("shows a blocked phase as blocked, not silently omitted", async () => {
    const snapshot = minimalSnapshot({
      blockers: [{ id: "b1", description: "Phase 4 depends on Phase 3, which is not yet done.", affects: ["Phase 4"], evidence: [{ source: "doc", locator: "docs/ROADMAP.md", detail: "x" }] }],
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText(/Phase 4 depends on Phase 3/)).toBeInTheDocument());
  });

  it("shows a merged/verified task distinctly from an in-progress one", async () => {
    const snapshot = minimalSnapshot({
      tasks: [
        { id: "7", title: "Dashboard live", source: "WORK_QUEUE.md", phaseId: "UNKNOWN", epic: "UNKNOWN", milestone: "UNKNOWN", status: "VERIFIED", statusMarker: "LIVE", dependencies: [], blockers: [], pullRequests: [], evidence: [{ source: "doc", locator: "x", detail: "x" }], isRecommendedNext: false },
      ],
      verification: [{ id: "v1", subject: "WORK_QUEUE.md item 7: Dashboard live", method: "LIVE", result: "PASS", evidence: [{ source: "doc", locator: "x", detail: "x" }] }],
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getAllByText(/Dashboard live/).length).toBeGreaterThan(0));
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("shows roadmap drift with both sources, never resolved silently", async () => {
    const snapshot = minimalSnapshot({
      roadmapDrift: [{ id: "d1", summary: "Doc says X, GitHub says Y.", sourceA: { source: "doc", locator: "docs/ecosystem/WORK_QUEUE.md", detail: "claims DONE" }, sourceB: { source: "github_api", locator: "https://github.com/x/y/pull/1", detail: "still open" }, detectedAt: "2026-09-06T00:00:00Z" }],
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText(/Doc says X, GitHub says Y/)).toBeInTheDocument());
    expect(screen.getByText(/claims DONE/)).toBeInTheDocument();
    expect(screen.getByText(/still open/)).toBeInTheDocument();
  });

  it("reports System Intelligence as unavailable, never a fake zero, when not configured", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(minimalSnapshot()), { status: 200 }))));
    render(<ControlRoomApp />);
    await waitFor(() => expect(screen.getByText(/not configured/)).toBeInTheDocument());
  });

  it("surfaces unreachable repos rather than silently dropping them", async () => {
    const snapshot = minimalSnapshot({ unreachableRepos: [{ slug: "kajisho5/renamed-skill", reason: "repos.get failed: 404" }] });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot), { status: 200 }))));

    render(<ControlRoomApp />);

    await waitFor(() => expect(screen.getByText(/到達できませんでした/)).toBeInTheDocument());
    expect(screen.getByText("kajisho5/renamed-skill")).toBeInTheDocument();
  });
});
