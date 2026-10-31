import type { RepositoryState } from "@ecosystem/control-room-types";
import { UNKNOWN } from "@ecosystem/control-room-types";
import { StatusChip } from "../../components/StatusChip.js";
import { Section } from "../../components/Section.js";
import { ciTone, booleanTone } from "../../lib/statusStyle.js";
import { useI18n } from "../../lib/i18n.js";

/** Section G-ish cross-repository view (task section 7): dependency + live-state
 * facts per repository, all pulled from the OS Dashboard's own generated snapshot
 * plus registry.json/capability-status.json -- never recomputed here. */
export function RepositoriesPanel({ repos, unreachable }: { repos: RepositoryState[]; unreachable: Array<{ slug: string; reason: string }> }) {
  const { t } = useI18n();
  const published = (v: boolean | typeof UNKNOWN) => t(v === UNKNOWN ? "crRepos.unknown" : v ? "crRepos.published" : "crRepos.unpublished");
  return (
    <Section title={t("crRepos.title", { count: repos.length })}>
      {unreachable.length > 0 && (
        <div className="error-banner">
          <strong>{t("crRepos.unreachable", { count: unreachable.length })}</strong>
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
              <StatusChip label={t("crRepos.contract", { value: published(r.contractPublished) })} tone={booleanTone(r.contractPublished)} />
              <StatusChip label={t("crRepos.provides", { value: published(r.providesPublished) })} tone={booleanTone(r.providesPublished)} />
              {r.liveState && <StatusChip label={`CI: ${r.liveState.ciConclusion}`} tone={ciTone(r.liveState.ciConclusion as never)} />}
            </div>
            {r.liveState && (
              <div className="meta">
                <span>{t("crRepos.openPrs", { count: r.liveState.openPullRequestCount })}</span>
                <span>{t("crRepos.openIssues", { count: r.liveState.openIssueCount })}</span>
                <span>{t("crRepos.maturity", { level: r.liveState.maturityLevel === UNKNOWN ? "?" : r.liveState.maturityLevel })}</span>
              </div>
            )}
            {r.dependsOn.length > 0 && <div className="note">{t("crRepos.dependsOn", { list: r.dependsOn.map((d) => d.split("/")[1] ?? d).join(", ") })}</div>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
