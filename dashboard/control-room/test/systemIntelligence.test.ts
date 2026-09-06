import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSystemIntelligenceSnapshot } from "../src/adapters/systemIntelligence.js";

function makeSnapshotDir(files: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), "si-snapshot-test-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ id: "snapshot-1" }));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), JSON.stringify(content));
  }
  return dir;
}

describe("loadSystemIntelligenceSnapshot", () => {
  it("reports unavailable, never a fake empty result, when no directory is configured", () => {
    const status = loadSystemIntelligenceSnapshot(undefined);
    expect(status.available).toBe(false);
    expect(status.reason).toContain("not set");
    expect(status.findings).toEqual([]);
  });

  it("reports unavailable when the configured directory has no manifest.json", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "not-a-snapshot-"));
    const status = loadSystemIntelligenceSnapshot(dir);
    expect(status.available).toBe(false);
    expect(status.reason).toContain("no manifest.json");
  });

  it("loads real findings, preserving SI's own field values verbatim", () => {
    const dir = makeSnapshotDir({
      "findings.json": [
        {
          id: "finding-abc123",
          category: "architecture",
          severity: "HIGH",
          statement: "Circular dependency detected.",
          confidence: "HIGH",
          affected_entity_ids: ["component-1"],
          evidence: [{ id: "evidence-1", kind: "AST", source: "static analysis", locator: "src/foo.py:10", observation: "import cycle", confidence: "HIGH", observed_at: "2026-01-01T00:00:00Z" }],
          suggested_actions: ["Break the cycle"],
        },
      ],
    });
    const status = loadSystemIntelligenceSnapshot(dir);
    expect(status.available).toBe(true);
    expect(status.findings).toHaveLength(1);
    expect(status.findings[0]).toMatchObject({ id: "finding-abc123", severity: "HIGH", statement: "Circular dependency detected." });
    expect(status.findings[0].evidence[0]).toMatchObject({ source: "si_snapshot", locator: "src/foo.py:10" });
  });

  it("reports 0 research/verification results honestly (those SI pipeline stages are unimplemented stubs, not this adapter's gap)", () => {
    const dir = makeSnapshotDir({});
    const status = loadSystemIntelligenceSnapshot(dir);
    expect(status.researchCount).toBe(0);
    expect(status.verificationCount).toBe(0);
    expect(status.available).toBe(true);
  });

  it("treats a malformed findings.json as empty rather than throwing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "si-snapshot-malformed-"));
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ id: "x" }));
    writeFileSync(path.join(dir, "findings.json"), "{not valid json");
    const status = loadSystemIntelligenceSnapshot(dir);
    expect(status.available).toBe(true);
    expect(status.findings).toEqual([]);
  });

  it("treats a findings.json that isn't a JSON array as empty rather than throwing", () => {
    const dir = makeSnapshotDir({ "findings.json": { not: "an array" } });
    const status = loadSystemIntelligenceSnapshot(dir);
    expect(status.findings).toEqual([]);
  });
});
