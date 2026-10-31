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
      <p className="note">{si.reason}</p>
      {si.available && (
        <>
          <div className="meta" style={{ marginTop: "var(--space-2)" }}>
            <span>Research: {si.researchCount}件</span>
            <span>Verification: {si.verificationCount}件（System Intelligence側の該当フェーズが未実装のため、現時点では常に0件）</span>
          </div>
          {si.findings.length > 0 && (
            <ul className="rows" style={{ marginTop: "var(--space-4)" }}>
              {si.findings.map((f) => (
                <li key={f.id} className="row">
                  <div className="row-head">
                    <strong className="row-title">{f.category}</strong>
                    <span className="mono note">
                      {f.severity} / {f.confidence}
                    </span>
                  </div>
                  <div className="row-body">{f.statement}</div>
                </li>
              ))}
            </ul>
          )}
          {si.recommendations.length > 0 && (
            <ul className="rows" style={{ marginTop: "var(--space-4)" }}>
              {si.recommendations.map((r) => (
                <li key={r.id} className="row">
                  <strong className="row-title">{r.objective}</strong>
                  <div className="row-body">{r.rationale}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}
