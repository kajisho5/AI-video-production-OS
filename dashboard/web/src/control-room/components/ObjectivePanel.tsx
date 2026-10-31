import type { Objective } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";
import { useI18n } from "../../lib/i18n.js";

/** Section A of the task spec: "What are we trying to build?" -- the Objective is
 * always the repository's own words (README.md), quoted, never paraphrased or
 * invented by this dashboard. */
export function ObjectivePanel({ objective }: { objective: Objective }) {
  const { t } = useI18n();
  return (
    <Section title={t("objective.title")} defaultOpen>
      <p className="objective">{objective.statement}</p>
      <div className="note" style={{ marginTop: "var(--space-3)" }}>
        {t("objective.source")} <span className="mono">{objective.evidence.locator}</span>
      </div>
    </Section>
  );
}
