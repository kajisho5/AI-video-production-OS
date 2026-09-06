import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Builds a throwaway directory shaped like a checkout of this repo, with only the
 * files the adapters under test actually read -- so tests can exercise missing/
 * malformed/empty variants without touching the real repository. */
export function makeFakeRepoRoot(overrides: Partial<{ readme: string; roadmap: string; workQueue: string; decisionLog: string }> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "control-room-test-"));
  mkdirSync(path.join(root, "docs", "ecosystem"), { recursive: true });
  writeFileSync(
    path.join(root, "README.md"),
    overrides.readme ??
      `# Test OS\n\n## What this is, in one sentence\n\nA test objective statement for unit tests.\n\n## Mission\n\nSomething else.\n`,
  );
  writeFileSync(path.join(root, "docs", "ROADMAP.md"), overrides.roadmap ?? "");
  writeFileSync(path.join(root, "docs", "ecosystem", "WORK_QUEUE.md"), overrides.workQueue ?? "");
  writeFileSync(path.join(root, "docs", "ecosystem", "DECISION_LOG.md"), overrides.decisionLog ?? "");
  return root;
}
