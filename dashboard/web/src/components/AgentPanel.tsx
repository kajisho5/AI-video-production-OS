import type { AgentStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";

function Row({ label, value, evidence }: { label: string; value: string | typeof UNKNOWN; evidence?: string | typeof UNKNOWN }) {
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ marginTop: 2 }}>
        {value === UNKNOWN ? <StatusChip label="不明" tone="unknown" /> : <span>{value}</span>}
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
      <Section title="エージェント状態">
        <StatusChip label="capability-status.json にAgentの記載がありません" tone="unknown" />
      </Section>
    );
  }

  return (
    <Section title="エージェント状態 — video-production-agent">
      <Row label="アーキテクチャ" value={agent.architecture} evidence={agent.architectureEvidence} />
      <Row label="Capability発見方式" value={agent.capabilityDiscovery} evidence={agent.capabilityDiscoveryEvidence} />
      <Row label="Skill統合" value={agent.skillIntegration} evidence={agent.skillIntegrationEvidence} />
      <Row label="AIプロバイダー" value={agent.aiProvider} evidence={agent.aiProviderEvidence} />
      <Row
        label="E2E検証"
        value={agent.verifiedEndToEnd.value === UNKNOWN ? UNKNOWN : agent.verifiedEndToEnd.value ? "あり" : "なし"}
        evidence={agent.verifiedEndToEnd.detail}
      />
      {agent.tests !== UNKNOWN && (
        <Row label="テスト" value={`${agent.tests.passing} / ${agent.tests.total} 件通過`} evidence={agent.tests.note} />
      )}
    </Section>
  );
}
