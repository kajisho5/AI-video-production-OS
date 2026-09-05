/**
 * Pure implementation of docs/ecosystem/MATURITY_MODEL.md. No network calls here --
 * this module only combines facts already fetched (RepoGithubFacts) with facts already
 * documented (a CapabilityStatusRepoEntry), so it is fully unit-testable without a real
 * GitHub connection (see aggregator/test/maturity.test.ts).
 */
import type { EvidenceSource, MaturityAssessment, MaturityLevel, RepoType } from "../../shared/types.js";
import type { CapabilityStatusRepoEntry } from "./config.js";
import type { RepoGithubFacts } from "./github.js";

export interface MaturityInput {
  repoType: RepoType;
  github: Pick<RepoGithubFacts, "exists" | "ci"> & { sizeKb: number | undefined };
  status: CapabilityStatusRepoEntry | undefined;
}

/** MATURITY_MODEL.md's ladder is defined in terms of a Skill's own Capability Contract,
 * `provides`, and the Agent's adapter for it -- these evidence definitions do not apply
 * to the OS repository or the Agent repository itself (there is nothing for the Agent
 * to "integrate into the Agent"). For those two repo types, this function stops at
 * level 1 (Scaffolded) and records why explicitly, rather than forcing an inapplicable
 * number. dashboard/web's OS Overview excludes OS/Agent from the maturity distribution
 * histogram for the same reason (see normalize.ts). */
export function computeMaturity(input: MaturityInput): MaturityAssessment {
  const evidence: MaturityAssessment["evidence"] = [];
  let level: MaturityLevel = 0;

  const level0Met = true; // being in registry.json at all is level 0's evidence
  evidence.push({ level: 0, met: level0Met, detail: "Listed in docs/ecosystem/registry.json", source: "documented" });
  if (level0Met) level = 0;

  if (!input.github.exists) {
    return { level: 0, evidence };
  }

  const level1Met = (input.github.sizeKb ?? 0) > 0;
  evidence.push({
    level: 1,
    met: level1Met,
    detail: level1Met
      ? "Repository exists on GitHub and is non-empty (size > 0 KB)"
      : "Repository exists on GitHub but reports zero size (likely empty/scaffolding-only)",
    source: "github_api",
  });
  if (level1Met) level = 1;
  else return { level, evidence };

  if (input.repoType === "OS" || input.repoType === "Agent") {
    evidence.push({
      level: 2,
      met: "UNKNOWN" as const,
      detail: `MATURITY_MODEL.md's levels 2-6 are defined in terms of a Skill's own Capability Contract and the Agent's integration of it; not applicable to repo type "${input.repoType}" itself.`,
      source: "documented",
    });
    return { level, evidence };
  }

  const contractPublished = input.status?.contract_published === true;
  const ciGreen = input.github.ci.conclusion === "success";
  const level2Met = contractPublished && ciGreen;
  evidence.push({
    level: 2,
    met: contractPublished ? (ciGreen ? true : false) : ("UNKNOWN" as const),
    detail: `contract_published=${input.status?.contract_published ?? "UNKNOWN (not documented)"}; CI conclusion on default branch=${input.github.ci.conclusion}`,
    source: mixedSource(input.status?.contract_published !== undefined, true),
  });
  if (level2Met) level = 2;
  else return { level, evidence };

  const providesPublished = input.status?.provides_published === true;
  evidence.push({
    level: 3,
    met: input.status?.provides_published === undefined ? ("UNKNOWN" as const) : providesPublished,
    detail: input.status?.provides_evidence ?? "Not documented in capability-status.json",
    source: "documented",
  });
  if (providesPublished) level = 3;
  else return { level, evidence };

  const integrated = input.status?.os_integration === "integrated" || input.status?.os_integration === "integrated_as_gate";
  evidence.push({
    level: 4,
    met: input.status?.os_integration === undefined ? ("UNKNOWN" as const) : integrated,
    detail: input.status?.os_integration_evidence ?? "Not documented in capability-status.json",
    source: "documented",
  });
  if (integrated) level = 4;
  else return { level, evidence };

  const verifiedE2e = input.status?.verified_e2e === "documented";
  evidence.push({
    level: 5,
    met: input.status?.verified_e2e === undefined ? ("UNKNOWN" as const) : verifiedE2e,
    detail: input.status?.verified_e2e_evidence ?? "Not documented in capability-status.json",
    source: "documented",
  });
  if (verifiedE2e) level = 5;
  else return { level, evidence };

  const distKind = input.status?.distribution?.kind;
  const distributed = distKind === "npm" || distKind === "pypi";
  evidence.push({
    level: 6,
    met: distKind === undefined ? ("UNKNOWN" as const) : distributed,
    detail: input.status?.distribution
      ? `distribution.kind=${distKind}, package=${input.status.distribution.package}`
      : "Not documented in capability-status.json",
    source: "documented",
  });
  if (distributed) level = 6;

  return { level, evidence };
}

function mixedSource(hasDocumented: boolean, hasGithub: boolean): EvidenceSource {
  if (hasDocumented && hasGithub) return "documented"; // conservatively label mixed evidence by its weaker (non-automatic) half
  if (hasGithub) return "github_api";
  if (hasDocumented) return "documented";
  return "UNKNOWN";
}
