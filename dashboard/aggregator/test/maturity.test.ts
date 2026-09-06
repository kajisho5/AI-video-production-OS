import { describe, expect, it } from "vitest";
import { computeMaturity } from "../src/maturity.js";
import type { CapabilityStatusRepoEntry } from "../src/config.js";

function githubFacts(overrides: Partial<{ exists: boolean; ciConclusion: string; sizeKb: number }> = {}) {
  return {
    exists: overrides.exists ?? true,
    ci: { conclusion: (overrides.ciConclusion ?? "success") as any, workflowName: "tests", runUrl: "https://x", updatedAt: "2026-09-05" },
    sizeKb: overrides.sizeKb ?? 100,
  };
}

describe("computeMaturity", () => {
  it("returns level 0 when the repo does not exist on GitHub", () => {
    const result = computeMaturity({ repoType: "Skill", github: githubFacts({ exists: false }), status: undefined });
    expect(result.level).toBe(0);
  });

  it("returns level 0 when the repo exists but is empty (size 0) -- MATURITY_MODEL.md level 0 explicitly includes 'exists but empty/scaffolding-only'", () => {
    const result = computeMaturity({ repoType: "Skill", github: githubFacts({ sizeKb: 0 }), status: undefined });
    expect(result.level).toBe(0);
  });

  it("stops at level 1 with no documented status at all (contract_published undefined)", () => {
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status: undefined });
    expect(result.level).toBe(1);
  });

  it("does not reach level 2 when CI is failing even if contract_published is true", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts({ ciConclusion: "failure" }), status });
    expect(result.level).toBe(1);
  });

  it("reaches level 2 when contract is published and CI is green", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(2);
  });

  it("reaches level 3 when provides is also published", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: true };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(3);
  });

  it("does NOT reach level 3 when provides_published is explicitly false (real case: ffmpeg-skill#24 still open)", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: false };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(2);
  });

  it("reaches level 4 when os_integration is 'integrated'", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: true, os_integration: "integrated" };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(4);
  });

  it("treats 'integrated_as_gate' as satisfying level 4 (qc-skill's real, deliberate role per ADR-032)", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: true, os_integration: "integrated_as_gate" };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(4);
  });

  it("reaches level 5 only when verified_e2e is exactly 'documented'", () => {
    const status: CapabilityStatusRepoEntry = {
      contract_published: true,
      provides_published: true,
      os_integration: "integrated",
      verified_e2e: "documented",
    };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(5);
  });

  it("does not reach level 6 on a documented distribution claim alone -- a live lookup must actually resolve a version", () => {
    const status: CapabilityStatusRepoEntry = {
      contract_published: true,
      provides_published: true,
      os_integration: "integrated",
      verified_e2e: "documented",
      distribution: { kind: "npm", package: "ffmpeg-skill" },
    };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    expect(result.level).toBe(5);
    expect(result.evidence.find((e) => e.level === 6)?.met).toBe("UNKNOWN");
  });

  it("reaches level 6 when the live npm/pypi lookup actually resolves a version", () => {
    const status: CapabilityStatusRepoEntry = {
      contract_published: true,
      provides_published: true,
      os_integration: "integrated",
      verified_e2e: "documented",
      distribution: { kind: "npm", package: "ffmpeg-skill" },
    };
    const result = computeMaturity({
      repoType: "Skill",
      github: githubFacts(),
      status,
      distributionLookup: { version: "0.9.2" },
    });
    expect(result.level).toBe(6);
    const level6 = result.evidence.find((e) => e.level === 6);
    expect(level6?.met).toBe(true);
    expect(level6?.source).toBe("package_registry");
    expect(level6?.detail).toContain("0.9.2");
  });

  it("does not reach level 6, but still reports UNKNOWN (not false), when the live lookup fails", () => {
    const status: CapabilityStatusRepoEntry = {
      contract_published: true,
      provides_published: true,
      os_integration: "integrated",
      verified_e2e: "documented",
      distribution: { kind: "npm", package: "some-renamed-package" },
    };
    const result = computeMaturity({
      repoType: "Skill",
      github: githubFacts(),
      status,
      distributionLookup: { version: "UNKNOWN", lookupError: "npm registry lookup failed: HTTP 404" },
    });
    expect(result.level).toBe(5);
    const level6 = result.evidence.find((e) => e.level === 6);
    expect(level6?.met).toBe("UNKNOWN");
    expect(level6?.source).toBe("package_registry");
    expect(level6?.detail).toContain("404");
  });

  it("caps repo types OS and Agent at level 1, marking higher levels not applicable rather than guessing", () => {
    const result = computeMaturity({ repoType: "OS", github: githubFacts(), status: { contract_published: true } });
    expect(result.level).toBe(1);
    expect(result.evidence.at(-1)?.detail).toMatch(/not applicable/i);
  });

  it("marks an unmeasured field as UNKNOWN met-value, never guessing false", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: true, os_integration: "integrated" };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    const level5 = result.evidence.find((e) => e.level === 5);
    expect(level5?.met).toBe("UNKNOWN");
  });

  it("every evidence entry names its source", () => {
    const status: CapabilityStatusRepoEntry = { contract_published: true, provides_published: true };
    const result = computeMaturity({ repoType: "Skill", github: githubFacts(), status });
    for (const e of result.evidence) {
      expect(e.source).toBeTruthy();
    }
  });
});
