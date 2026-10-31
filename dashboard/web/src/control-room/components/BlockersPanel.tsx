import type { Blocker } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section F: cross-repository blockers, shown 1:1 with their evidence -- never a
 * severity score, never a guessed impact ranking. */
export function BlockersPanel({ blockers }: { blockers: Blocker[] }) {
  return (
    <Section title={`ブロッカー (${blockers.length})`} defaultOpen={blockers.length > 0}>
      {blockers.length === 0 ? (
        <p className="empty">現在検出されているブロッカーはありません。</p>
      ) : (
        <ul className="rows">
          {blockers.map((b) => (
            <li key={b.id} className="row">
              <span className="status-chip bad">ブロック中</span>
              <div className="row-body">{b.description}</div>
              {b.affects.length > 0 && <div className="note">影響範囲: {b.affects.join(", ")}</div>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
