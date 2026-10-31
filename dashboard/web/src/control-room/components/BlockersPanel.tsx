import type { Blocker } from "@ecosystem/control-room-types";
import { Section } from "../../components/Section.js";
import { useI18n } from "../../lib/i18n.js";

/** Section F: cross-repository blockers, shown 1:1 with their evidence -- never a
 * severity score, never a guessed impact ranking. */
export function BlockersPanel({ blockers }: { blockers: Blocker[] }) {
  const { t } = useI18n();
  return (
    <Section title={t("blockers.title", { count: blockers.length })} defaultOpen={blockers.length > 0}>
      {blockers.length === 0 ? (
        <p className="empty">{t("blockers.empty")}</p>
      ) : (
        <ul className="rows">
          {blockers.map((b) => (
            <li key={b.id} className="row">
              <span className="status-chip bad">{t("lifecycle.BLOCKED")}</span>
              <div className="row-body">{b.description}</div>
              {b.affects.length > 0 && <div className="note">{t("blockers.affects", { list: b.affects.join(", ") })}</div>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
