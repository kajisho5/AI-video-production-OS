import type { Bottleneck } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";
import { bottleneckKindLabel } from "../lib/labels.js";
import { useI18n } from "../lib/i18n.js";

/** Every row here corresponds 1:1 to an explicit rule in aggregator/src/bottlenecks.ts
 * -- no scoring, no "looks stuck" inference (task requirement). */
export function BottlenecksPanel({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const { t } = useI18n();
  return (
    <Section title={t("bottlenecks.title", { count: bottlenecks.length })} defaultOpen={bottlenecks.length > 0}>
      {bottlenecks.length === 0 ? (
        <p className="empty">{t("bottlenecks.empty")}</p>
      ) : (
        <div className="rows">
          {bottlenecks.map((b, i) => (
            <div className="bottleneck-row" key={`${b.repoSlug}-${b.kind}-${i}`}>
              <StatusChip label={bottleneckKindLabel(t, b.kind)} tone="bad" />
              <div>
                <div className="mono slug">{b.repoSlug}</div>
                <div>{b.summary}</div>
                {b.evidenceUrl !== UNKNOWN && (
                  <a href={b.evidenceUrl as string} target="_blank" rel="noreferrer" className="note">
                    {t("bottlenecks.evidence")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
