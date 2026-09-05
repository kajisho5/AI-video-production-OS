import type { Bottleneck } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { Section } from "./Section.js";
import { StatusChip } from "./StatusChip.js";

const KIND_LABEL: Record<Bottleneck["kind"], string> = {
  ci_failing_default_branch: "CI failing",
  pr_merge_conflict: "Merge conflict",
  pr_stale_open: "Stale PR",
  capability_not_declared: "No Capability declared",
  not_os_integrated: "Not OS-integrated",
  dependency_not_integrated: "Dependency not integrated",
};

/** Every row here corresponds 1:1 to an explicit rule in aggregator/src/bottlenecks.ts
 * -- no scoring, no "looks stuck" inference (task requirement). */
export function BottlenecksPanel({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  return (
    <Section title={`Bottlenecks (${bottlenecks.length})`} defaultOpen={bottlenecks.length > 0}>
      {bottlenecks.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          No explicit-evidence bottlenecks detected this run — see docs/ecosystem/WORK_QUEUE.md for planned work not
          captured by an automatic rule.
        </p>
      ) : (
        <div>
          {bottlenecks.map((b, i) => (
            <div className="bottleneck-row" key={`${b.repoSlug}-${b.kind}-${i}`}>
              <StatusChip label={KIND_LABEL[b.kind]} tone="bad" />
              <div>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {b.repoSlug}
                </div>
                <div>{b.summary}</div>
                {b.evidenceUrl !== UNKNOWN && (
                  <a href={b.evidenceUrl as string} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    evidence
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
