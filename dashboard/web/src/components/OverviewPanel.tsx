import type { OsOverview } from "@ecosystem/types";
import { maturityLevelName } from "../lib/labels.js";
import { useI18n } from "../lib/i18n.js";
import { Section } from "./Section.js";

/** Deliberately never renders a single "progress %" -- docs/ecosystem/MATURITY_MODEL.md
 * explains why: no invented composite score, only a real, auditable distribution across
 * the 7 maturity levels, restricted to repo types that ladder actually applies to. */
export function OverviewPanel({ overview }: { overview: OsOverview }) {
  const { t, locale } = useI18n();
  const maxCount = Math.max(1, ...overview.maturityDistribution.counts);

  return (
    <Section title={t("overview.title")} defaultOpen>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{overview.totalRepos}</div>
          <div className="stat-label">{t("overview.repos")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{overview.openPullRequestsTotal}</div>
          <div className="stat-label">{t("overview.openPrs")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{overview.openIssuesTotal}</div>
          <div className="stat-label">{t("overview.openIssues")}</div>
        </div>
        <div className="stat">
          <div className={overview.ciFailingCount > 0 ? "stat-value is-fail" : "stat-value"}>{overview.ciFailingCount}</div>
          <div className="stat-label">{t("overview.ciFailing")}</div>
        </div>
      </div>

      <h3 className="sub-title">
        {t("overview.maturity", { count: overview.maturityDistribution.totalRepos })}
      </h3>
      <div className="dist">
        {overview.maturityDistribution.counts.map((count, level) => (
          <div key={level} className="dist-row">
            <div className="dist-label">
              {level}. {maturityLevelName(t, level as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
            </div>
            <div className="dist-track">
              <div className="dist-fill" style={{ width: `${(count / maxCount) * 100}%`, minWidth: count > 0 ? 3 : 0 }} />
            </div>
            <div className="dist-count">{count}</div>
          </div>
        ))}
      </div>

      {overview.recentlyChangedRepos.length > 0 && (
        <>
          <h3 className="sub-title">{t("overview.recent")}</h3>
          <ul className="recent">
            {overview.recentlyChangedRepos.slice(0, 6).map((r) => (
              <li key={r.slug}>
                <span className="mono">{r.slug.split("/")[1]}</span>
                <span>{new Date(r.lastUpdatedAt).toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
