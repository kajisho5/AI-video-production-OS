import type { OsOverview } from "@ecosystem/types";
import { MATURITY_LEVEL_NAMES } from "@ecosystem/types";
import { Section } from "./Section.js";

/** Deliberately never renders a single "progress %" -- docs/ecosystem/MATURITY_MODEL.md
 * explains why: no invented composite score, only a real, auditable distribution across
 * the 7 maturity levels, restricted to repo types that ladder actually applies to. */
export function OverviewPanel({ overview }: { overview: OsOverview }) {
  const maxCount = Math.max(1, ...overview.maturityDistribution.counts);

  return (
    <Section title="OS Overview" defaultOpen>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{overview.totalRepos}</div>
          <div className="stat-label">Repositories</div>
        </div>
        <div className="stat">
          <div className="stat-value">{overview.openPullRequestsTotal}</div>
          <div className="stat-label">Open PRs</div>
        </div>
        <div className="stat">
          <div className="stat-value">{overview.openIssuesTotal}</div>
          <div className="stat-label">Open issues</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={overview.ciFailingCount > 0 ? { color: "var(--status-bad)" } : undefined}>
            {overview.ciFailingCount}
          </div>
          <div className="stat-label">CI failing</div>
        </div>
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <div className="panel-title" style={{ marginBottom: "var(--space-2)" }}>
          Maturity distribution ({overview.maturityDistribution.totalRepos} Skill/Provider/Extension repos — see MATURITY_MODEL.md)
        </div>
        {overview.maturityDistribution.counts.map((count, level) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 4 }}>
            <div style={{ width: 150, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
              {level}. {MATURITY_LEVEL_NAMES[level as 0 | 1 | 2 | 3 | 4 | 5 | 6]}
            </div>
            <div style={{ flex: 1, background: "var(--border)", borderRadius: 3, height: 10, position: "relative" }}>
              <div
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  background: "var(--status-neutral)",
                  height: "100%",
                  borderRadius: 3,
                  minWidth: count > 0 ? 3 : 0,
                }}
              />
            </div>
            <div className="mono" style={{ width: 20, textAlign: "right", fontSize: 12 }}>
              {count}
            </div>
          </div>
        ))}
      </div>

      {overview.recentlyChangedRepos.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <div className="panel-title" style={{ marginBottom: "var(--space-2)" }}>
            Recently changed
          </div>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            {overview.recentlyChangedRepos.slice(0, 6).map((r) => (
              <div key={r.slug} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                <span className="mono">{r.slug.split("/")[1]}</span>
                <span>{new Date(r.lastUpdatedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
