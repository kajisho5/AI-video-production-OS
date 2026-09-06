import type { RoadmapDrift } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section K: "Surface discrepancies... Show the discrepancy as evidence." Never
 * silently resolves Source A vs Source B in either's favor -- both are shown, with
 * their own locators, and the reader (human or Claude Code) decides which is
 * right. */
export function RoadmapDriftPanel({ drifts }: { drifts: RoadmapDrift[] }) {
  return (
    <Section title={`ロードマップの食い違い (${drifts.length})`} defaultOpen={drifts.length > 0}>
      {drifts.length === 0 ? (
        <p className="footer-note">現在検出されている食い違いはありません。</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {drifts.map((d) => (
            <li key={d.id} className="panel" style={{ padding: 10 }}>
              <div className="status-chip warn" style={{ marginBottom: 6 }}>DRIFT DETECTED</div>
              <div style={{ fontSize: 13.5 }}>{d.summary}</div>
              <div className="footer-note" style={{ marginTop: 6 }}>
                Source A: <span className="mono">{d.sourceA.locator}</span> — {d.sourceA.detail}
              </div>
              <div className="footer-note">
                Source B: <span className="mono">{d.sourceB.locator}</span> — {d.sourceB.detail}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
