import type { Blocker } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section F: cross-repository blockers, shown 1:1 with their evidence -- never a
 * severity score, never a guessed impact ranking. */
export function BlockersPanel({ blockers }: { blockers: Blocker[] }) {
  return (
    <Section title={`ブロッカー (${blockers.length})`} defaultOpen={blockers.length > 0}>
      {blockers.length === 0 ? (
        <p className="footer-note">現在検出されているブロッカーはありません。</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {blockers.map((b) => (
            <li key={b.id} className="panel" style={{ padding: 10 }}>
              <div className="status-chip bad" style={{ marginBottom: 4 }}>ブロック中</div>
              <div style={{ fontSize: 13.5 }}>{b.description}</div>
              {b.affects.length > 0 && <div className="footer-note">影響範囲: {b.affects.join(", ")}</div>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
