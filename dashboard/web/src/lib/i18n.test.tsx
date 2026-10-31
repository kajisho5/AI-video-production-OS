import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App.js";
import ControlRoomApp from "../control-room/ControlRoomApp.js";
import { LANG_STORAGE_KEY, MESSAGES, withLang } from "./i18n.js";
import type { EcosystemSnapshot } from "@ecosystem/types";

function snapshot(): EcosystemSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-09-05T21:00:00Z",
    generator: { name: "ecosystem-dashboard-aggregator", version: "0.1.0" },
    authTokenPresent: false,
    rateLimit: { remaining: 59, limit: 60 },
    overview: {
      totalRepos: 0,
      reposByType: { OS: 0, Agent: 0, Skill: 0, Provider: 0, Extension: 0 },
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
  };
}

function headerLinks() {
  const nav = screen.getByRole("navigation");
  const [dashboard, controlRoom] = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
  const home = screen.getByRole("link", { name: /^(Home|紹介ページ)$/ }).getAttribute("href");
  return { dashboard, controlRoom, home };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // stays loading: chrome only
  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = "initial";
  document.head.appendChild(meta);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelector('meta[name="description"]')?.remove();
});

describe("UI language", () => {
  it("is English by default, with English page metadata and EN pressed", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ecosystem dashboard");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("AI Video Production OS — Ecosystem dashboard");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/^A read-only view/);
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "JA" })).toHaveAttribute("aria-pressed", "false");
  });

  it("picks Japanese from ?lang=ja", () => {
    window.history.replaceState(null, "", "/?lang=ja");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("エコシステムダッシュボード");
    expect(document.documentElement.lang).toBe("ja");
    expect(document.title).toBe("AI Video Production OS — エコシステムダッシュボード");
    expect(screen.getByRole("button", { name: "JA" })).toHaveAttribute("aria-pressed", "true");
  });

  it(`picks Japanese from a stored ${LANG_STORAGE_KEY}=ja (a choice made on the landing page)`, () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "ja");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("エコシステムダッシュボード");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("lets an explicit ?lang=en win over a stored choice, as on the landing page", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "ja");
    window.history.replaceState(null, "", "/?lang=en");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ecosystem dashboard");
  });

  it("carries a stored choice over to the Control Room too", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "ja");
    render(<ControlRoomApp />);
    expect(screen.getByText(/コントロールルームのスナップショットを読み込み中/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ja");
  });

  it("toggling writes the shared key, updates <html lang> and the URL, and back again", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "JA" }));
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(new URL(window.location.href).searchParams.get("lang")).toBe("ja");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("エコシステムダッシュボード");
    expect(screen.getByRole("button", { name: "JA" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(new URL(window.location.href).searchParams.has("lang")).toBe(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ecosystem dashboard");
  });

  it("keeps ?lang=ja on the header's page and landing-page links only while Japanese is active", () => {
    render(<App />);
    let links = headerLinks();
    expect(links.dashboard).not.toContain("lang=");
    expect(links.controlRoom).not.toContain("lang=");
    expect(links.home).not.toContain("lang=");

    fireEvent.click(screen.getByRole("button", { name: "JA" }));
    links = headerLinks();
    expect(links.dashboard).toMatch(/\?lang=ja$/);
    expect(links.controlRoom).toMatch(/control-room\.html\?lang=ja$/);
    expect(links.home).toMatch(/\?lang=ja$/);
  });

  it("formats dates with the active locale", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshot()), { status: 200 }))));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/^Generated /)).toBeInTheDocument());
    expect(screen.getByText(/^Generated /).textContent).toMatch(/9\/[56]\/2026/);
    expect(screen.getByText(/GitHub API access: unauthenticated/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "JA" }));
    expect(screen.getByText(/生成$/).textContent).toMatch(/2026\/9\/[56]/);
    expect(screen.getByText(/認証なし/)).toBeInTheDocument();
  });
});

describe("dictionaries", () => {
  it("give every Japanese string the same placeholders as its English source, and none empty", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of Object.keys(MESSAGES.en) as Array<keyof typeof MESSAGES.en>) {
      expect(MESSAGES.ja[key], key).not.toBe("");
      expect(placeholders(MESSAGES.ja[key]), key).toBe(placeholders(MESSAGES.en[key]));
    }
  });

  it("withLang adds ?lang=ja (or &lang=ja) only for Japanese", () => {
    expect(withLang("/x/", "en")).toBe("/x/");
    expect(withLang("/x/", "ja")).toBe("/x/?lang=ja");
    expect(withLang("/x/?a=1", "ja")).toBe("/x/?a=1&lang=ja");
  });
});
