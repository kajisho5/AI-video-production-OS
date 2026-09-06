import type { SystemIntelligenceStatus } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section I: System Intelligence findings/recommendations. Never executes a
 * proposal, never merges, never installs anything -- purely a read-through of
 * whatever an SI snapshot (if configured) already contains. Its own severity/
 * confidence vocabulary is shown verbatim, not remapped into this dashboard's own
 * status colors, since SI is a separate project with its own conventions. */
export function IntelligencePanel({ si }: { si: SystemIntelligenceStatus }) {
  return (
    <Section title="System Intelligence">
      <p className="footer-note">{si.reason}</p>
      {si.available && (
        <>
          <div className="footer-note" style={{ marginTop: 4 }}>
            Research: {si.researchCount}件 · Verification: {si.verificationCount}件（System Intelligence側の該当フェーズが未実装のため、現時点では常に0件）
          </div>
          {si.findings.length > 0 && (
            <ul style={{ listStyle: "none", margin: "12px 0 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {si.findings.map((f) => (
                <li key={f.id} className="panel" style={{ padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{f.category}</strong>
                    <span className="mono footer-note">
                      {f.severity} / {f.confidence}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 4 }}>{f.statement}</div>
                </li>
              ))}
            </ul>
          )}
          {si.recommendations.length > 0 && (
            <ul style={{ listStyle: "none", margin: "12px 0 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {si.recommendations.map((r) => (
                <li key={r.id} className="panel" style={{ padding: 10 }}>
                  <strong style={{ fontSize: 13 }}>{r.objective}</strong>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{r.rationale}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}
