import type { Objective } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section A of the task spec: "What are we trying to build?" -- the Objective is
 * always the repository's own words (README.md), quoted, never paraphrased or
 * invented by this dashboard. */
export function ObjectivePanel({ objective }: { objective: Objective }) {
  return (
    <Section title="現在の目標 (Current Objective)" defaultOpen>
      <p className="objective">{objective.statement}</p>
      <div className="note" style={{ marginTop: "var(--space-3)" }}>
        出典: <span className="mono">{objective.evidence.locator}</span>
      </div>
    </Section>
  );
}
