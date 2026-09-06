/**
 * Aggregator entrypoint. Run only in CI (or a developer's own machine for testing) --
 * never in a browser. Reads docs/ecosystem/registry.json + capability-status.json,
 * fetches live GitHub state for every listed repo, and writes one normalized
 * EcosystemSnapshot JSON file. See docs/adr/ADR-011-ecosystem-dashboard.md.
 *
 *   GITHUB_TOKEN=<token> npm run generate            (with a token: ~5000 req/hr)
 *   npm run generate                                  (without: unauthenticated, ~60 req/hr)
 *   OUTPUT_PATH=./out.json npm run generate            (defaults to ../web/public/data/ecosystem-snapshot.json)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentStatus } from "./agentStatus.js";
import { detectBottlenecks } from "./bottlenecks.js";
import { loadCapabilityStatus, loadRegistry } from "./config.js";
import { fetchRateLimit, fetchRepoFacts, makeOctokit } from "./github.js";
import { buildGraph, buildOverview, buildRepoStatus } from "./normalize.js";
import { fetchLatestVersion } from "./packageRegistry.js";
import type { EcosystemSnapshot, Unknown } from "../../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.resolve(__dirname, "../../web/public/data/ecosystem-snapshot.json");
const GENERATOR_VERSION = "0.1.0";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const outputPath = process.env.OUTPUT_PATH ?? DEFAULT_OUTPUT;

  const registry = loadRegistry();
  const capabilityStatus = loadCapabilityStatus();
  const octokit = makeOctokit(token);

  const fetchedAt = new Date().toISOString();
  const repos = [];
  const unreachableRepos: EcosystemSnapshot["unreachableRepos"] = [];

  for (const entry of registry.repos) {
    const [owner, repo] = entry.slug.split("/");
    process.stderr.write(`Fetching ${entry.slug}...\n`);
    const facts = await fetchRepoFacts(octokit, owner, repo);
    if (!facts.exists) {
      unreachableRepos.push({ slug: entry.slug, reason: facts.fetchErrors.join("; ") || "unknown reason" });
      continue;
    }
    const status = capabilityStatus.repos[entry.slug];
    let distributionLookup: { version: string | Unknown; lookupError?: string } | undefined;
    const distKind = status?.distribution?.kind;
    if ((distKind === "npm" || distKind === "pypi") && status?.distribution?.package) {
      process.stderr.write(`  Looking up live ${distKind} version for ${status.distribution.package}...\n`);
      const result = await fetchLatestVersion(distKind, status.distribution.package);
      distributionLookup = { version: result.version, lookupError: result.error };
    }
    repos.push(buildRepoStatus(entry, facts, status, fetchedAt, distributionLookup));
  }

  const bottlenecks = detectBottlenecks(repos);
  const overview = buildOverview(repos, bottlenecks);
  const graph = buildGraph(repos);
  const agent = buildAgentStatus(capabilityStatus.repos["kajisho5/video-production-agent"]);
  const rateLimit = await fetchRateLimit(octokit);

  const snapshot: EcosystemSnapshot = {
    schemaVersion: 1,
    generatedAt: fetchedAt,
    generator: { name: "ecosystem-dashboard-aggregator", version: GENERATOR_VERSION },
    authTokenPresent: Boolean(token),
    rateLimit,
    overview,
    repos,
    agent,
    bottlenecks,
    graph,
    unreachableRepos,
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf-8");
  process.stderr.write(`Wrote ${outputPath} (${repos.length} repos, ${bottlenecks.length} bottlenecks)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
