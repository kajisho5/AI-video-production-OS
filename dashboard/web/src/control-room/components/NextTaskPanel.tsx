import type { NextExecutableTaskRecommendation } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section C: "The highest-priority actionable task that is actually ready, with
 * evidence." Always rendered as a recommendation, never as settled fact -- the
 * task's own explicit requirement. */
export function NextTaskPanel({ next }: { next: NextExecutableTaskRecommendation | null }) {
  return (
    <Section title="次に着手すべきタスク (Next Executable Task)" defaultOpen>
      {next === null ? (
        <p className="footer-note">現時点で「未着手・PR未作成」の推奨タスクはありません。</p>
      ) : (
        <div>
          <div className="status-chip neutral" style={{ marginBottom: 8 }}>
            推奨 (Recommendation) — 確定した事実ではありません
          </div>
          <p style={{ fontSize: 15 }}>
            WORK_QUEUE.md item <strong>{next.taskId}</strong>
          </p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{next.reason}</p>
          {next.evidence.map((e, i) => (
            <div className="footer-note" key={i}>
              根拠: <span className="mono">{e.locator}</span> — {e.detail}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
