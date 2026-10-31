import type { NextExecutableTaskRecommendation } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";

/** Section C: "The highest-priority actionable task that is actually ready, with
 * evidence." Always rendered as a recommendation, never as settled fact -- the
 * task's own explicit requirement. */
export function NextTaskPanel({ next }: { next: NextExecutableTaskRecommendation | null }) {
  return (
    <Section title="次に着手すべきタスク (Next Executable Task)" defaultOpen>
      {next === null ? (
        <p className="empty">現時点で「未着手・PR未作成」の推奨タスクはありません。</p>
      ) : (
        <div>
          <div className="status-chip neutral wrap">
            推奨 (Recommendation) — 確定した事実ではありません
          </div>
          <p className="next-task">
            WORK_QUEUE.md item <mark>{next.taskId}</mark>
          </p>
          <p className="row-body">{next.reason}</p>
          {next.evidence.map((e, i) => (
            <div className="note" key={i}>
              根拠: <span className="mono">{e.locator}</span> — {e.detail}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
