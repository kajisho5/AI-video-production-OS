import type { AgentStatus, EvidencedBoolean } from "../../shared/types.js";
import { UNKNOWN } from "../../shared/types.js";
import type { CapabilityStatusRepoEntry } from "./config.js";

const AGENT_SLUG = "kajisho5/video-production-agent";

export function buildAgentStatus(status: CapabilityStatusRepoEntry | undefined): AgentStatus | null {
  if (!status) return null;

  const verifiedEndToEnd: EvidencedBoolean =
    status.verified_e2e === undefined
      ? { value: UNKNOWN, source: UNKNOWN, detail: UNKNOWN }
      : { value: status.verified_e2e === "documented", source: "documented", detail: (status.verified_e2e_evidence as string) ?? "documented" };

  const tests = status.tests as { total: number; passing: number; note: string } | undefined;

  return {
    slug: AGENT_SLUG,
    architecture: (status.architecture as string) ?? UNKNOWN,
    architectureEvidence: (status.architecture_evidence as string) ?? UNKNOWN,
    capabilityDiscovery: (status.capability_discovery as string) ?? UNKNOWN,
    capabilityDiscoveryEvidence: (status.capability_discovery_evidence as string) ?? UNKNOWN,
    skillIntegration: (status.skill_integration as string) ?? UNKNOWN,
    skillIntegrationEvidence: (status.skill_integration_evidence as string) ?? UNKNOWN,
    aiProvider: (status.ai_provider as string) ?? UNKNOWN,
    aiProviderEvidence: (status.ai_provider_evidence as string) ?? UNKNOWN,
    tests: tests ?? UNKNOWN,
    verifiedEndToEnd,
  };
}
