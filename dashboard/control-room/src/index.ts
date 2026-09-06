/**
 * Ecosystem Control Room generator entrypoint. Run only in CI (or a developer's own
 * machine) -- never in a browser. Reads this repo's own ROADMAP.md/WORK_QUEUE.md/
 * DECISION_LOG.md/registry.json/capability-status.json, the OS Dashboard's own
 * already-generated ecosystem-snapshot.json, resolves any PR numbers WORK_QUEUE.md
 * cites against live GitHub state, and (if SI_SNAPSHOT_DIR is set) an on-disk System
 * Intelligence snapshot -- into one ControlRoomSnapshot JSON file.
 *
 *   GITHUB_TOKEN=<token> npm run generate
 *   SI_SNAPSHOT_DIR=/path/to/si-snapshot npm run generate
 *   OUTPUT_PATH=./out.json npm run generate   (defaults to ../web/public/data/control-room-snapshot.json)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCapabilityStatus, loadRegistry } from "../../aggregator/src/config.js";
import { extractObjective, detectDecisionLogDuplicateIds, parseRoadmapPhases, parseWorkQueueTasks } from "./adapters/ecosystemDocs.js";
import { loadEcosystemSnapshot, makeOctokit, resolvePullRequestCitations } from "./adapters/githubState.js";
import { loadSystemIntelligenceSnapshot } from "./adapters/systemIntelligence.js";
import { buildDependencies, buildRepositories, computeNextExecutableTask, computePhaseDependencyBlockers, computeTaskPrDrift, extractVerificationRecords } from "./normalize.js";
import type { ControlRoomSnapshot } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_OUTPUT = path.resolve(__dirname, "../../web/public/data/control-room-snapshot.json");
const DEFAULT_ECOSYSTEM_SNAPSHOT = path.resolve(__dirname, "../../web/public/data/ecosystem-snapshot.json");
const GENERATOR_VERSION = "0.1.0";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const outputPath = process.env.OUTPUT_PATH ?? DEFAULT_OUTPUT;
  const ecosystemSnapshotPath = process.env.ECOSYSTEM_SNAPSHOT_PATH ?? DEFAULT_ECOSYSTEM_SNAPSHOT;

  const registry = loadRegistry();
  const capabilityStatus = loadCapabilityStatus();
  const knownRepoNames = registry.repos.map((r) => r.name);

  const objective = extractObjective(REPO_ROOT);
  const phases = parseRoadmapPhases(REPO_ROOT);
  const tasks = parseWorkQueueTasks(REPO_ROOT, knownRepoNames);
  const decisionLogDrift = detectDecisionLogDuplicateIds(REPO_ROOT);

  const octokit = makeOctokit(token);
  for (const task of tasks) {
    task.pullRequests = await resolvePullRequestCitations(octokit, task.pullRequests);
  }

  const ecosystemSnapshot = loadEcosystemSnapshot(ecosystemSnapshotPath);
  const repositories = buildRepositories(registry, capabilityStatus, ecosystemSnapshot);
  const dependencies = buildDependencies(registry);
  const blockers = computePhaseDependencyBlockers(phases);
  const nextExecutableTask = computeNextExecutableTask(tasks);
  if (nextExecutableTask) {
    const t = tasks.find((x) => x.id === nextExecutableTask.taskId);
    if (t) t.isRecommendedNext = true;
  }
  const taskPrDrift = computeTaskPrDrift(tasks);
  const verification = extractVerificationRecords(tasks);
  const systemIntelligence = loadSystemIntelligenceSnapshot(process.env.SI_SNAPSHOT_DIR);

  const snapshot: ControlRoomSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: { name: "ecosystem-control-room", version: GENERATOR_VERSION },
    objective,
    phases,
    tasks,
    repositories,
    dependencies,
    blockers,
    nextExecutableTask,
    verification,
    systemIntelligence,
    roadmapDrift: [...decisionLogDrift, ...taskPrDrift],
    unreachableRepos: ecosystemSnapshot?.unreachableRepos ?? [],
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf-8");
  process.stderr.write(`Wrote ${outputPath} (${phases.length} phases, ${tasks.length} tasks, ${repositories.length} repos, ${snapshot.roadmapDrift.length} drift finding(s))\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
