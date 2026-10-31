import type { VerificationRecord } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section J: "What has actually been verified." Only WORK_QUEUE.md items the
 * document itself marks as verified (LIVE) appear here -- everything else is
 * absent, not silently marked "not verified" as if that were a failure. */
export function VerificationPanel({ records }: { records: VerificationRecord[] }) {
  return (
    <Section title={`検証済み (${records.length})`}>
      {records.length === 0 ? (
        <p className="empty">WORK_QUEUE.mdが「検証済み」と明記している項目は現在ありません。</p>
      ) : (
        <ul className="rows">
          {records.map((v) => (
            <li key={v.id} className="row">
              <div className="row-head">
                <strong className="row-title">{v.subject}</strong>
                <span className="status-chip ok">{v.result}</span>
              </div>
              <div className="note">{v.method}</div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
