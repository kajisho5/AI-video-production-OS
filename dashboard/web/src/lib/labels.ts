/**
 * UI-chrome Japanese labels. Scope is deliberately narrow: only this app's own
 * static labels/headings/status vocabulary are translated here. Real GitHub-sourced
 * content (PR titles, commit messages, repo slugs) and the two ecosystem-state JSON
 * files (docs/ecosystem/registry.json's `role`, capability-status.json's `evidence`/
 * `detail` strings) are left in English on purpose: they are meant to mirror this
 * project's English-language prose docs (CROSS_REPO_STATUS.md, CURRENT_STATE.md, ...)
 * exactly (ADR-011), and translating them here would silently fork that mirror.
 */
import type { CiConclusion, MaturityLevel, RepoType } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import type { Bottleneck } from "@ecosystem/types";

export const MATURITY_LEVEL_NAMES_JA: Record<MaturityLevel, string> = {
  0: "提案段階",
  1: "雛形あり",
  2: "契約公開済み",
  3: "Capability宣言済み",
  4: "OS統合済み",
  5: "E2E検証済み",
  6: "配布済み",
};

export const REPO_TYPE_LABEL_JA: Record<RepoType, string> = {
  OS: "OS",
  Agent: "エージェント",
  Skill: "Skill",
  Provider: "プロバイダー",
  Extension: "拡張",
};

export function ciConclusionLabelJa(conclusion: CiConclusion): string {
  if (conclusion === UNKNOWN) return "CI 不明";
  const map: Record<string, string> = {
    success: "CI 成功",
    failure: "CI 失敗",
    neutral: "CI 中立",
    cancelled: "CI キャンセル",
    timed_out: "CI タイムアウト",
    action_required: "CI 要対応",
    in_progress: "CI 実行中",
  };
  return map[conclusion] ?? `CI ${conclusion}`;
}

export const BOTTLENECK_KIND_LABEL_JA: Record<Bottleneck["kind"], string> = {
  ci_failing_default_branch: "CI失敗",
  pr_merge_conflict: "マージ競合",
  pr_stale_open: "長期停滞PR",
  capability_not_declared: "Capability未宣言",
  not_os_integrated: "OS未統合",
  dependency_not_integrated: "依存先が未統合",
};
