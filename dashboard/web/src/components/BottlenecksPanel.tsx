import type { Bottleneck } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";
import { BOTTLENECK_KIND_LABEL_JA } from "../lib/labels.js";

/** Every row here corresponds 1:1 to an explicit rule in aggregator/src/bottlenecks.ts
 * -- no scoring, no "looks stuck" inference (task requirement). */
export function BottlenecksPanel({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  return (
    <Section title={`ボトルネック（${bottlenecks.length}件）`} defaultOpen={bottlenecks.length > 0}>
      {bottlenecks.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          今回の実行で明示的な根拠に基づくボトルネックは検出されませんでした — 自動ルールで捕捉されない計画中の作業は
          docs/ecosystem/WORK_QUEUE.md を参照してください。
        </p>
      ) : (
        <div>
          {bottlenecks.map((b, i) => (
            <div className="bottleneck-row" key={`${b.repoSlug}-${b.kind}-${i}`}>
              <StatusChip label={BOTTLENECK_KIND_LABEL_JA[b.kind]} tone="bad" />
              <div>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {b.repoSlug}
                </div>
                <div>{b.summary}</div>
                {b.evidenceUrl !== UNKNOWN && (
                  <a href={b.evidenceUrl as string} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    根拠を見る
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
