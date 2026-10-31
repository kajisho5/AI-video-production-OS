import type { RoadmapDrift } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";
import { useI18n } from "../../lib/i18n.js";

/** Section K: "Surface discrepancies... Show the discrepancy as evidence." Never
 * silently resolves Source A vs Source B in either's favor -- both are shown, with
 * their own locators, and the reader (human or Claude Code) decides which is
 * right. */
export function RoadmapDriftPanel({ drifts }: { drifts: RoadmapDrift[] }) {
  const { t } = useI18n();
  return (
    <Section title={t("drift.title", { count: drifts.length })} defaultOpen={drifts.length > 0}>
      {drifts.length === 0 ? (
        <p className="empty">{t("drift.empty")}</p>
      ) : (
        <ul className="rows">
          {drifts.map((d) => (
            <li key={d.id} className="row">
              <span className="status-chip warn">{t("drift.badge")}</span>
              <div className="row-body">{d.summary}</div>
              <div className="note">
                Source A: <span className="mono">{d.sourceA.locator}</span> — {d.sourceA.detail}
              </div>
              <div className="note">
                Source B: <span className="mono">{d.sourceB.locator}</span> — {d.sourceB.detail}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
