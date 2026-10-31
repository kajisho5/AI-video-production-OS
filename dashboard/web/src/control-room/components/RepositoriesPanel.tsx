import type { RepositoryState } from "@ecosystem/control-room-types";
import { UNKNOWN } from "@ecosystem/control-room-types";
import { StatusChip } from "../../components/StatusChip.js";
import { Section } from "../../components/Section.js";
import { ciTone, booleanTone } from "../../lib/statusStyle.js";

/** Section G-ish cross-repository view (task section 7): dependency + live-state
 * facts per repository, all pulled from the OS Dashboard's own generated snapshot
 * plus registry.json/capability-status.json -- never recomputed here. */
export function RepositoriesPanel({ repos, unreachable }: { repos: RepositoryState[]; unreachable: Array<{ slug: string; reason: string }> }) {
  return (
    <Section title={`リポジトリ (${repos.length})`}>
      {unreachable.length > 0 && (
        <div className="error-banner">
          <strong>{unreachable.length}件のリポジトリに到達できませんでした：</strong>
          <ul>
            {unreachable.map((r) => (
              <li key={r.slug}>
                <span className="mono">{r.slug}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="rows">
        {repos.map((r) => (
          <li key={r.slug} className="row">
            <div className="row-head">
              <strong className="row-title">{r.name}</strong>
              <span className="mono note">{r.type}</span>
            </div>
            <div className="note">{r.role}</div>
            <div className="chips">
              <StatusChip label={`Contract: ${r.contractPublished === UNKNOWN ? "不明" : r.contractPublished ? "公開済み" : "未公開"}`} tone={booleanTone(r.contractPublished)} />
              <StatusChip label={`provides: ${r.providesPublished === UNKNOWN ? "不明" : r.providesPublished ? "公開済み" : "未公開"}`} tone={booleanTone(r.providesPublished)} />
              {r.liveState && <StatusChip label={`CI: ${r.liveState.ciConclusion}`} tone={ciTone(r.liveState.ciConclusion as never)} />}
            </div>
            {r.liveState && (
              <div className="meta">
                <span>Open PR: {r.liveState.openPullRequestCount}</span>
                <span>Open Issue: {r.liveState.openIssueCount}</span>
                <span>Maturity: Lv{r.liveState.maturityLevel === UNKNOWN ? "?" : r.liveState.maturityLevel}</span>
              </div>
            )}
            {r.dependsOn.length > 0 && <div className="note">依存先: {r.dependsOn.map((d) => d.split("/")[1] ?? d).join(", ")}</div>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
