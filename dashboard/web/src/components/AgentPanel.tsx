import type { AgentStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";

function Row({ label, value, evidence }: { label: string; value: string | typeof UNKNOWN; evidence?: string | typeof UNKNOWN }) {
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ marginTop: 2 }}>
        {value === UNKNOWN ? <StatusChip label="UNKNOWN" tone="unknown" /> : <span>{value}</span>}
      </div>
      {evidence && evidence !== UNKNOWN && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{evidence}</div>
      )}
    </div>
  );
}

export function AgentPanel({ agent }: { agent: AgentStatus | null }) {
  if (!agent) {
    return (
      <Section title="Agent status">
        <StatusChip label="No Agent documented in capability-status.json" tone="unknown" />
      </Section>
    );
  }

  return (
    <Section title="Agent status — video-production-agent">
      <Row label="Architecture" value={agent.architecture} evidence={agent.architectureEvidence} />
      <Row label="Capability discovery" value={agent.capabilityDiscovery} evidence={agent.capabilityDiscoveryEvidence} />
      <Row label="Skill integration" value={agent.skillIntegration} evidence={agent.skillIntegrationEvidence} />
      <Row label="AI Provider" value={agent.aiProvider} evidence={agent.aiProviderEvidence} />
      <Row
        label="Verified end-to-end"
        value={agent.verifiedEndToEnd.value === UNKNOWN ? UNKNOWN : agent.verifiedEndToEnd.value ? "yes" : "no"}
        evidence={agent.verifiedEndToEnd.detail}
      />
      {agent.tests !== UNKNOWN && (
        <Row label="Tests" value={`${agent.tests.passing} / ${agent.tests.total} passing`} evidence={agent.tests.note} />
      )}
    </Section>
  );
}
