import type { RepoStatus } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import { StatusChip } from "./StatusChip.js";
import { booleanTone, ciTone } from "../lib/statusStyle.js";
import { ciConclusionLabelJa, MATURITY_LEVEL_NAMES_JA, REPO_TYPE_LABEL_JA } from "../lib/labels.js";
import { Section } from "./Section.js";

function CiChip({ repo }: { repo: RepoStatus }) {
  const tone = ciTone(repo.ci.conclusion);
  const label = ciConclusionLabelJa(repo.ci.conclusion);
  return repo.ci.runUrl !== UNKNOWN ? (
    <a href={repo.ci.runUrl as string} target="_blank" rel="noreferrer">
      <StatusChip label={label} tone={tone} />
    </a>
  ) : (
    <StatusChip label={label} tone={tone} />
  );
}

function ProvidesChip({ repo }: { repo: RepoStatus }) {
  const v = repo.providesPublished.value;
  const label = v === UNKNOWN ? "provides: 不明" : v ? "provides: あり" : "provides: なし";
  return <StatusChip label={label} tone={booleanTone(v)} />;
}

function RelativeTime({ iso }: { iso: string | typeof UNKNOWN }) {
  if (iso === UNKNOWN) return <StatusChip label="不明" tone="unknown" />;
  return <span title={iso}>{new Date(iso).toLocaleDateString("ja-JP")}</span>;
}

function RepoCard({ repo }: { repo: RepoStatus }) {
  return (
    <li className="repo-row">
      <div className="repo-row-header">
        <div className="repo-name">
          <a href={`https://github.com/${repo.slug}`} target="_blank" rel="noreferrer">
            {repo.name}
          </a>
        </div>
        <span className="type-badge">{REPO_TYPE_LABEL_JA[repo.type]}</span>
      </div>
      <div className="repo-role">{repo.role}</div>
      <div className="repo-meta-row">
        <span className="chips">
          <CiChip repo={repo} />
          {repo.type === "Skill" && <ProvidesChip repo={repo} />}
        </span>
        <span>
          Lv{repo.maturity.level} {MATURITY_LEVEL_NAMES_JA[repo.maturity.level]}
        </span>
      </div>
      <div className="repo-meta-row">
        <span>オープンPR {repo.openPullRequests.length}件</span>
        <span>オープンIssue {repo.openIssues.length}件</span>
        <span>
          更新 <RelativeTime iso={repo.lastUpdatedAt} />
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
              {pr.mergeableState === "dirty" && <StatusChip label="競合あり" tone="bad" />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RepoTableRow({ repo }: { repo: RepoStatus }) {
  return (
    <tr>
      <td>
        <a className="repo-link" href={`https://github.com/${repo.slug}`} target="_blank" rel="noreferrer">
          {repo.name}
        </a>
      </td>
      <td>
        <span className="type-badge">{REPO_TYPE_LABEL_JA[repo.type]}</span>
      </td>
      <td>
        <CiChip repo={repo} />
      </td>
      <td className="num">{repo.openPullRequests.length}</td>
      <td className="num">{repo.openIssues.length}</td>
      <td>{repo.type === "Skill" ? <ProvidesChip repo={repo} /> : <span className="dim">—</span>}</td>
      <td>
        Lv{repo.maturity.level} {MATURITY_LEVEL_NAMES_JA[repo.maturity.level]}
      </td>
      <td className="num">
        <RelativeTime iso={repo.lastUpdatedAt} />
      </td>
    </tr>
  );
}

export function RepoList({ repos }: { repos: RepoStatus[] }) {
  return (
    <Section title={`リポジトリ（${repos.length}件）`}>
      <ul className="mobile-only repo-rows">
        {repos.map((r) => (
          <RepoCard key={r.slug} repo={r} />
        ))}
      </ul>
      <div className="desktop-only report table-scroll">
        <table className="repo-table">
          <thead>
            <tr>
              <th>リポジトリ</th>
              <th>種別</th>
              <th>CI</th>
              <th className="num">PR</th>
              <th className="num">Issue</th>
              <th>Capability</th>
              <th>成熟度</th>
              <th className="num">更新日</th>
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
