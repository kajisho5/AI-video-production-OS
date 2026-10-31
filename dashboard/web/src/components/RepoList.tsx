import type { RepoStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { StatusChip } from "./StatusChip.js";
import { booleanTone, ciTone } from "../lib/statusStyle.js";
import { ciConclusionLabel, maturityLevelName, repoTypeLabel } from "../lib/labels.js";
import { useI18n } from "../lib/i18n.js";
import { Section } from "./Section.js";

function CiChip({ repo }: { repo: RepoStatus }) {
  const { t } = useI18n();
  const tone = ciTone(repo.ci.conclusion);
  const label = ciConclusionLabel(t, repo.ci.conclusion);
  return repo.ci.runUrl !== UNKNOWN ? (
    <a href={repo.ci.runUrl as string} target="_blank" rel="noreferrer">
      <StatusChip label={label} tone={tone} />
    </a>
  ) : (
    <StatusChip label={label} tone={tone} />
  );
}

function ProvidesChip({ repo }: { repo: RepoStatus }) {
  const { t } = useI18n();
  const v = repo.providesPublished.value;
  const label = t("repos.provides", { value: t(v === UNKNOWN ? "repos.unknown" : v ? "repos.yes" : "repos.no") });
  return <StatusChip label={label} tone={booleanTone(v)} />;
}

function RelativeTime({ iso }: { iso: string | typeof UNKNOWN }) {
  const { t, locale } = useI18n();
  if (iso === UNKNOWN) return <StatusChip label={t("common.unknown")} tone="unknown" />;
  return <span title={iso}>{new Date(iso).toLocaleDateString(locale)}</span>;
}

function RepoCard({ repo }: { repo: RepoStatus }) {
  const { t } = useI18n();
  return (
    <li className="repo-row">
      <div className="repo-row-header">
        <div className="repo-name">
          <a href={`https://github.com/${repo.slug}`} target="_blank" rel="noreferrer">
            {repo.name}
          </a>
        </div>
        <span className="type-badge">{repoTypeLabel(t, repo.type)}</span>
      </div>
      <div className="repo-role">{repo.role}</div>
      <div className="repo-meta-row">
        <span className="chips">
          <CiChip repo={repo} />
          {repo.type === "Skill" && <ProvidesChip repo={repo} />}
        </span>
        <span>
          Lv{repo.maturity.level} {maturityLevelName(t, repo.maturity.level)}
        </span>
      </div>
      <div className="repo-meta-row">
        <span>{t("repos.openPrs", { count: repo.openPullRequests.length })}</span>
        <span>{t("repos.openIssues", { count: repo.openIssues.length })}</span>
        <span>
          {t("repos.updated")} <RelativeTime iso={repo.lastUpdatedAt} />
        </span>
      </div>
      {repo.openPullRequests.length > 0 && (
        <ul className="repo-prs">
          {repo.openPullRequests.slice(0, 3).map((pr) => (
            <li key={pr.number}>
              <a href={pr.url} target="_blank" rel="noreferrer">
                #{pr.number} {pr.title}
              </a>
              {pr.draft && <span className="type-badge">draft</span>}
              {pr.mergeableState === "dirty" && <StatusChip label={t("repos.conflict")} tone="bad" />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RepoTableRow({ repo }: { repo: RepoStatus }) {
  const { t } = useI18n();
  return (
    <tr>
      <td>
        <a className="repo-link" href={`https://github.com/${repo.slug}`} target="_blank" rel="noreferrer">
          {repo.name}
        </a>
      </td>
      <td>
        <span className="type-badge">{repoTypeLabel(t, repo.type)}</span>
      </td>
      <td>
        <CiChip repo={repo} />
      </td>
      <td className="num">{repo.openPullRequests.length}</td>
      <td className="num">{repo.openIssues.length}</td>
      <td>{repo.type === "Skill" ? <ProvidesChip repo={repo} /> : <span className="dim">—</span>}</td>
      <td>
        Lv{repo.maturity.level} {maturityLevelName(t, repo.maturity.level)}
      </td>
      <td className="num">
        <RelativeTime iso={repo.lastUpdatedAt} />
      </td>
    </tr>
  );
}

export function RepoList({ repos }: { repos: RepoStatus[] }) {
  const { t } = useI18n();
  return (
    <Section title={t("repos.title", { count: repos.length })}>
      <ul className="mobile-only repo-rows">
        {repos.map((r) => (
          <RepoCard key={r.slug} repo={r} />
        ))}
      </ul>
      <div className="desktop-only report table-scroll">
        <table className="repo-table">
          <thead>
            <tr>
              <th>{t("repos.col.repo")}</th>
              <th>{t("repos.col.type")}</th>
              <th>CI</th>
              <th className="num">PR</th>
              <th className="num">Issue</th>
              <th>Capability</th>
              <th>{t("repos.col.maturity")}</th>
              <th className="num">{t("repos.col.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <RepoTableRow key={r.slug} repo={r} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
