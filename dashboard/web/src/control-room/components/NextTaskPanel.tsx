import type { NextExecutableTaskRecommendation } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";
import { useI18n } from "../../lib/i18n.js";

/** Section C: "The highest-priority actionable task that is actually ready, with
 * evidence." Always rendered as a recommendation, never as settled fact -- the
 * task's own explicit requirement. */
export function NextTaskPanel({ next }: { next: NextExecutableTaskRecommendation | null }) {
  const { t } = useI18n();
  return (
    <Section title={t("next.title")} defaultOpen>
      {next === null ? (
        <p className="empty">{t("next.empty")}</p>
      ) : (
        <div>
          <div className="status-chip neutral wrap">{t("next.badge")}</div>
          <p className="next-task">
            {t("next.item")} <mark>{next.taskId}</mark>
          </p>
          <p className="row-body">{next.reason}</p>
          {next.evidence.map((e, i) => (
            <div className="note" key={i}>
              {t("next.evidence")} <span className="mono">{e.locator}</span> — {e.detail}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
