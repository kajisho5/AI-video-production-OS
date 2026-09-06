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
        <div className="error-banner" style={{ marginBottom: 12 }}>
          <strong>{unreachable.length}件のリポジトリに到達できませんでした：</strong>
          <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
            {unreachable.map((r) => (
              <li key={r.slug} style={{ fontSize: 13 }}>
                <span className="mono">{r.slug}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {repos.map((r) => (
          <li key={r.slug} className="panel" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>{r.name}</strong>
              <span className="mono footer-note">{r.type}</span>
            </div>
            <div className="footer-note" style={{ marginTop: 4 }}>{r.role}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <StatusChip label={`Contract: ${r.contractPublished === UNKNOWN ? "不明" : r.contractPublished ? "公開済み" : "未公開"}`} tone={booleanTone(r.contractPublished)} />
              <StatusChip label={`provides: ${r.providesPublished === UNKNOWN ? "不明" : r.providesPublished ? "公開済み" : "未公開"}`} tone={booleanTone(r.providesPublished)} />
              {r.liveState && <StatusChip label={`CI: ${r.liveState.ciConclusion}`} tone={ciTone(r.liveState.ciConclusion as never)} />}
            </div>
            {r.liveState && (
              <div className="footer-note" style={{ marginTop: 4 }}>
                Open PR: {r.liveState.openPullRequestCount} · Open Issue: {r.liveState.openIssueCount} · Maturity: Lv{r.liveState.maturityLevel === UNKNOWN ? "?" : r.liveState.maturityLevel}
              </div>
            )}
            {r.dependsOn.length > 0 && <div className="footer-note">依存先: {r.dependsOn.map((d) => d.split("/")[1] ?? d).join(", ")}</div>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
