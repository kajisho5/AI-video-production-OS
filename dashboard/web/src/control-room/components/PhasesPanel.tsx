import type { Phase } from "@ecosystem/control-room-types";
import { StatusChip } from "../../components/StatusChip.js";
import { Section } from "../../components/Section.js";
import { lifecycleLabelJa, lifecycleTone } from "../lifecycleTone.js";

/** Section B: "Phase / Epic / Milestone / Task hierarchy as supported by source
 * evidence." This ecosystem's own docs only support the Phase level structurally
 * (docs/ROADMAP.md) -- Epic/Milestone are shown per-Task as UNKNOWN in TasksPanel
 * rather than invented here. */
export function PhasesPanel({ phases }: { phases: Phase[] }) {
  return (
    <Section title={`ロードマップ — Phase (${phases.length})`}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {phases.map((p) => (
          <li key={p.id} className="panel" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>
                {p.id} — {p.title}
              </strong>
              <StatusChip label={lifecycleLabelJa(p.status)} tone={lifecycleTone(p.status)} />
            </div>
            <div className="footer-note" style={{ marginTop: 4 }}>{p.statusText}</div>
            {p.dependsOnPhaseIds.length > 0 && <div className="footer-note">依存: {p.dependsOnPhaseIds.join(", ")}</div>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
