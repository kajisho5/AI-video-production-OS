import type { AgentStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";
import { useI18n } from "../lib/i18n.js";

function Row({ label, value, evidence }: { label: string; value: string | typeof UNKNOWN; evidence?: string | typeof UNKNOWN }) {
  const { t } = useI18n();
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        <div>{value === UNKNOWN ? <StatusChip label={t("common.unknown")} tone="unknown" /> : <span>{value}</span>}</div>
        {evidence && evidence !== UNKNOWN && <div className="evidence">{evidence}</div>}
      </dd>
    </div>
  );
}

export function AgentPanel({ agent }: { agent: AgentStatus | null }) {
  const { t } = useI18n();
  if (!agent) {
    return (
      <Section title={t("agent.title")}>
        <StatusChip label={t("agent.missing")} tone="unknown" />
      </Section>
    );
  }

  return (
    <Section title={t("agent.titleNamed", { name: "video-production-agent" })}>
      <dl className="facts">
        <Row label={t("agent.architecture")} value={agent.architecture} evidence={agent.architectureEvidence} />
        <Row label={t("agent.capabilityDiscovery")} value={agent.capabilityDiscovery} evidence={agent.capabilityDiscoveryEvidence} />
        <Row label={t("agent.skillIntegration")} value={agent.skillIntegration} evidence={agent.skillIntegrationEvidence} />
        <Row label={t("agent.aiProvider")} value={agent.aiProvider} evidence={agent.aiProviderEvidence} />
        <Row
          label={t("agent.e2e")}
          value={agent.verifiedEndToEnd.value === UNKNOWN ? UNKNOWN : agent.verifiedEndToEnd.value ? t("agent.yes") : t("agent.no")}
          evidence={agent.verifiedEndToEnd.detail}
        />
        {agent.tests !== UNKNOWN && (
          <Row label={t("agent.tests")} value={t("agent.testsValue", { passing: agent.tests.passing, total: agent.tests.total })} evidence={agent.tests.note} />
        )}
      </dl>
    </Section>
  );
}
