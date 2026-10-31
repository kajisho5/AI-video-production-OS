/**
 * UI language for the Dashboard and the Control Room: English by default, Japanese on
 * request -- the same rule and the same storage key as the landing page (site/index.html):
 *   1. `?lang=ja` (or `?lang=en`) in the URL wins,
 *   2. else `localStorage["avos-lang"]`,
 *   3. else English.
 * The pages share one origin with the landing page, so a choice made there carries over.
 *
 * Scope is deliberately narrow: only this app's own chrome (headings, labels, status
 * vocabulary, empty/error states, page metadata) is translated. Data from the snapshots
 * (repo names and roles, PR titles, roadmap and WORK_QUEUE.md text, evidence strings) is
 * shown exactly as generated: it mirrors the project's English prose docs (ADR-011), and
 * translating it here would silently fork that mirror.
 *
 * `en` is the source of truth; `ja` is typed against its keys, so a missing translation
 * is a type error. Placeholders are `{name}` and are filled by `translate`.
 */
import { createContext, useContext } from "react";

export type Lang = "en" | "ja";

/** Shared with site/index.html. Do not rename without changing the landing page too. */
export const LANG_STORAGE_KEY = "avos-lang";

export const LOCALES: Record<Lang, string> = { en: "en-US", ja: "ja-JP" };

const en = {
  // Header (both pages)
  "header.skip": "Skip to content",
  "header.pages": "Pages",
  "header.dashboard": "Dashboard",
  "header.controlRoom": "Control Room",
  "header.home": "Home",
  "header.language": "Language",

  // Shared
  "common.unknown": "Unknown",
  "common.generatedAt": "Generated {date}",

  // Page metadata
  "meta.dashboard.title": "Velisa — Ecosystem dashboard",
  "meta.dashboard.description": "A read-only view of the real GitHub state of the Velisa ecosystem.",
  "meta.controlRoom.title": "Ecosystem Control Room — Velisa",
  "meta.controlRoom.description":
    "The Velisa development control plane: roadmap, running tasks, PR and CI state, and System Intelligence findings in one read-only view.",

  // Ecosystem Dashboard
  "dashboard.title": "Ecosystem dashboard",
  "dashboard.lede.before": "A read-only view of the ecosystem's real state. Development progress is in the ",
  "dashboard.lede.link": "Control Room",
  "dashboard.lede.after": ".",
  "dashboard.loading": "Loading the ecosystem snapshot…",
  "dashboard.error.title": "Couldn't load the ecosystem snapshot.",
  "dashboard.error.hint":
    "This dashboard only ever reads a static, pre-generated JSON file and never calls GitHub directly (see dashboard/README.md). If the site was just deployed, the aggregation workflow may not have run yet.",
  "dashboard.unreachable": "Unreachable repositories in registry.json ({count}):",
  "dashboard.footer.apiAccess": "GitHub API access: {state}",
  "dashboard.footer.authenticated": "authenticated",
  "dashboard.footer.unauthenticated": "unauthenticated",
  "dashboard.footer.rateLimit": "Rate limit {value}",

  "overview.title": "OS overview",
  "overview.repos": "Repositories",
  "overview.openPrs": "Open PRs",
  "overview.openIssues": "Open issues",
  "overview.ciFailing": "CI failing",
  "overview.maturity": "Maturity distribution ({count} Skill/Provider/Extension repos, see MATURITY_MODEL.md)",
  "overview.recent": "Recently updated",

  "maturity.0": "Proposed",
  "maturity.1": "Scaffolded",
  "maturity.2": "Contract published",
  "maturity.3": "Capability declared",
  "maturity.4": "OS integrated",
  "maturity.5": "E2E verified",
  "maturity.6": "Distributed",

  "repoType.OS": "OS",
  "repoType.Agent": "Agent",
  "repoType.Skill": "Skill",
  "repoType.Provider": "Provider",
  "repoType.Extension": "Extension",

  "ci.UNKNOWN": "CI unknown",
  "ci.success": "CI passing",
  "ci.failure": "CI failing",
  "ci.neutral": "CI neutral",
  "ci.cancelled": "CI cancelled",
  "ci.timed_out": "CI timed out",
  "ci.action_required": "CI needs action",
  "ci.in_progress": "CI running",
  "ci.other": "CI {value}",

  "bottlenecks.title": "Bottlenecks ({count})",
  "bottlenecks.empty":
    "No evidence-backed bottlenecks were found in this run. For planned work the automatic rules don't catch, see docs/ecosystem/WORK_QUEUE.md.",
  "bottlenecks.evidence": "View evidence",
  "bottleneck.ci_failing_default_branch": "CI failing",
  "bottleneck.pr_merge_conflict": "Merge conflict",
  "bottleneck.pr_stale_open": "Stale PR",
  "bottleneck.capability_not_declared": "Capability not declared",
  "bottleneck.not_os_integrated": "Not OS integrated",
  "bottleneck.dependency_not_integrated": "Dependency not integrated",

  "agent.title": "Agent status",
  "agent.titleNamed": "Agent status — {name}",
  "agent.missing": "capability-status.json has no Agent entry",
  "agent.architecture": "Architecture",
  "agent.capabilityDiscovery": "Capability discovery",
  "agent.skillIntegration": "Skill integration",
  "agent.aiProvider": "AI provider",
  "agent.e2e": "Verified end to end",
  "agent.yes": "Yes",
  "agent.no": "No",
  "agent.tests": "Tests",
  "agent.testsValue": "{passing} / {total} passing",

  "repos.title": "Repositories ({count})",
  "repos.provides": "provides: {value}",
  "repos.yes": "yes",
  "repos.no": "no",
  "repos.unknown": "unknown",
  "repos.openPrs": "Open PRs {count}",
  "repos.openIssues": "Open issues {count}",
  "repos.updated": "Updated",
  "repos.conflict": "Merge conflict",
  "repos.col.repo": "Repository",
  "repos.col.type": "Type",
  "repos.col.maturity": "Maturity",
  "repos.col.updated": "Updated",

  "graph.title": "Ecosystem map",
  "graph.dependencies": "Dependencies",
  "graph.dependsOn": "depends on",

  // Control Room
  "controlRoom.title": "Ecosystem Control Room",
  "controlRoom.lede": "Velisa: a cross-repository view of development (read-only control plane).",
  "controlRoom.lede2.before": "The OS's current state is on the ",
  "controlRoom.lede2.link": "Ecosystem dashboard",
  "controlRoom.lede2.after": ".",
  "controlRoom.loading": "Loading the Control Room snapshot…",
  "controlRoom.error.title": "Couldn't load the snapshot.",
  "controlRoom.error.hint.before": "The dashboard/control-room generator workflow may not have run yet (",
  "controlRoom.error.hint.after": ").",

  "objective.title": "Current objective",
  "objective.source": "Source:",

  "next.title": "Next executable task",
  "next.empty": "There is no recommended task that is both unstarted and without a PR right now.",
  "next.badge": "Recommendation, not a settled fact",
  "next.item": "WORK_QUEUE.md item",
  "next.evidence": "Evidence:",

  "drift.title": "Roadmap drift ({count})",
  "drift.empty": "No drift detected right now.",
  "drift.badge": "Drift detected",

  "blockers.title": "Blockers ({count})",
  "blockers.empty": "No blockers detected right now.",
  "blockers.affects": "Affects: {list}",

  "tasks.title": "Tasks ({count})",
  "tasks.active": "In progress, with a PR",
  "tasks.activeEmpty": "No tasks with a PR are in progress right now.",
  "tasks.prePr": "No PR yet, planned or ready",
  "tasks.prePrEmpty": "There are no tasks without a PR.",
  "tasks.done": "Done, verified or deferred",
  "tasks.doneEmpty": "No tasks are finished yet.",
  "tasks.recommended": "Recommended task",
  "tasks.unknownRepo": "Unknown repository",
  "tasks.pr.merged": "Merged",
  "tasks.pr.draft": "Draft",
  "tasks.pr.open": "Open",
  "tasks.pr.closed": "Closed",
  "tasks.pr.notFound": "Not found",
  "tasks.pr.ambiguous": "Repository unclear",
  "tasks.pr.unresolved": "Unresolved",

  "phases.title": "Roadmap phases ({count})",
  "phases.dependsOn": "Depends on: {list}",

  "crRepos.title": "Repositories ({count})",
  "crRepos.unreachable": "Unreachable repositories ({count}):",
  "crRepos.contract": "Contract: {value}",
  "crRepos.provides": "provides: {value}",
  "crRepos.published": "published",
  "crRepos.unpublished": "not published",
  "crRepos.unknown": "unknown",
  "crRepos.openPrs": "Open PRs: {count}",
  "crRepos.openIssues": "Open issues: {count}",
  "crRepos.maturity": "Maturity: Lv{level}",
  "crRepos.dependsOn": "Depends on: {list}",

  "si.research": "Research: {count}",
  "si.verification": "Verification: {count} (always 0 for now, because System Intelligence hasn't built that phase yet)",

  "verification.title": "Verified ({count})",
  "verification.empty": "WORK_QUEUE.md doesn't mark any item as verified right now.",

  "lifecycle.PLANNED": "Planned",
  "lifecycle.READY": "Ready",
  "lifecycle.IN_PROGRESS": "In progress",
  "lifecycle.BLOCKED": "Blocked",
  "lifecycle.DRAFT_PR": "Draft PR",
  "lifecycle.CI": "CI running",
  "lifecycle.REVIEW": "In review",
  "lifecycle.WAITING_APPROVAL": "Awaiting approval",
  "lifecycle.MERGED": "Merged",
  "lifecycle.VERIFIED": "Verified",
  "lifecycle.DONE": "Done",
  "lifecycle.DEFERRED": "Deferred",
  "lifecycle.UNKNOWN": "Unknown",
};

export type MessageKey = keyof typeof en;

const ja: Record<MessageKey, string> = {
  "header.skip": "本文へスキップ",
  "header.pages": "ページ",
  "header.dashboard": "ダッシュボード",
  "header.controlRoom": "コントロールルーム",
  "header.home": "紹介ページ",
  "header.language": "言語",

  "common.unknown": "不明",
  "common.generatedAt": "{date} 生成",

  "meta.dashboard.title": "Velisa — エコシステムダッシュボード",
  "meta.dashboard.description": "Velisa エコシステムの実際のGitHub状態を映す、読み取り専用の観測レイヤー。",
  "meta.controlRoom.title": "Ecosystem Control Room — Velisa",
  "meta.controlRoom.description":
    "Velisaエコシステムの開発コントロールプレーン — ロードマップ・実行中タスク・PR/CI状態・System Intelligenceの所見を一箇所に集約する読み取り専用ビュー。",

  "dashboard.title": "エコシステムダッシュボード",
  "dashboard.lede.before": "読み取り専用の観測レイヤー。開発の進み具合は",
  "dashboard.lede.link": "コントロールルーム",
  "dashboard.lede.after": "で見られます。",
  "dashboard.loading": "エコシステムのスナップショットを読み込み中…",
  "dashboard.error.title": "エコシステムのスナップショットを読み込めませんでした。",
  "dashboard.error.hint":
    "このダッシュボードは常に静的な生成済みJSONファイルのみを読み込みます — GitHubを直接呼び出すことはありません（dashboard/README.md参照）。デプロイ直後の場合、集計ワークフローがまだ実行されていない可能性があります。",
  "dashboard.unreachable": "registry.json内の{count}件のリポジトリに到達できませんでした：",
  "dashboard.footer.apiAccess": "GitHub APIアクセス：{state}",
  "dashboard.footer.authenticated": "認証あり",
  "dashboard.footer.unauthenticated": "認証なし",
  "dashboard.footer.rateLimit": "レート制限 {value}",

  "overview.title": "OS概要",
  "overview.repos": "リポジトリ数",
  "overview.openPrs": "オープンPR",
  "overview.openIssues": "オープンIssue",
  "overview.ciFailing": "CI失敗",
  "overview.maturity": "成熟度分布（Skill/Provider/Extension {count}件 — MATURITY_MODEL.md参照）",
  "overview.recent": "最近の更新",

  "maturity.0": "提案段階",
  "maturity.1": "雛形あり",
  "maturity.2": "契約公開済み",
  "maturity.3": "Capability宣言済み",
  "maturity.4": "OS統合済み",
  "maturity.5": "E2E検証済み",
  "maturity.6": "配布済み",

  "repoType.OS": "OS",
  "repoType.Agent": "エージェント",
  "repoType.Skill": "Skill",
  "repoType.Provider": "プロバイダー",
  "repoType.Extension": "拡張",

  "ci.UNKNOWN": "CI 不明",
  "ci.success": "CI 成功",
  "ci.failure": "CI 失敗",
  "ci.neutral": "CI 中立",
  "ci.cancelled": "CI キャンセル",
  "ci.timed_out": "CI タイムアウト",
  "ci.action_required": "CI 要対応",
  "ci.in_progress": "CI 実行中",
  "ci.other": "CI {value}",

  "bottlenecks.title": "ボトルネック（{count}件）",
  "bottlenecks.empty":
    "今回の実行で明示的な根拠に基づくボトルネックは検出されませんでした — 自動ルールで捕捉されない計画中の作業は docs/ecosystem/WORK_QUEUE.md を参照してください。",
  "bottlenecks.evidence": "根拠を見る",
  "bottleneck.ci_failing_default_branch": "CI失敗",
  "bottleneck.pr_merge_conflict": "マージ競合",
  "bottleneck.pr_stale_open": "長期停滞PR",
  "bottleneck.capability_not_declared": "Capability未宣言",
  "bottleneck.not_os_integrated": "OS未統合",
  "bottleneck.dependency_not_integrated": "依存先が未統合",

  "agent.title": "エージェント状態",
  "agent.titleNamed": "エージェント状態 — {name}",
  "agent.missing": "capability-status.json にAgentの記載がありません",
  "agent.architecture": "アーキテクチャ",
  "agent.capabilityDiscovery": "Capability発見方式",
  "agent.skillIntegration": "Skill統合",
  "agent.aiProvider": "AIプロバイダー",
  "agent.e2e": "E2E検証",
  "agent.yes": "あり",
  "agent.no": "なし",
  "agent.tests": "テスト",
  "agent.testsValue": "{passing} / {total} 件通過",

  "repos.title": "リポジトリ（{count}件）",
  "repos.provides": "provides: {value}",
  "repos.yes": "あり",
  "repos.no": "なし",
  "repos.unknown": "不明",
  "repos.openPrs": "オープンPR {count}件",
  "repos.openIssues": "オープンIssue {count}件",
  "repos.updated": "更新",
  "repos.conflict": "競合あり",
  "repos.col.repo": "リポジトリ",
  "repos.col.type": "種別",
  "repos.col.maturity": "成熟度",
  "repos.col.updated": "更新日",

  "graph.title": "エコシステム構成図",
  "graph.dependencies": "依存関係",
  "graph.dependsOn": "が依存",

  "controlRoom.title": "Ecosystem Control Room",
  "controlRoom.lede": "Velisa — 開発状況の横断ビュー（読み取り専用・制御プレーン）",
  "controlRoom.lede2.before": "OSの現状は",
  "controlRoom.lede2.link": "エコシステムダッシュボード",
  "controlRoom.lede2.after": "で見られます。",
  "controlRoom.loading": "コントロールルームのスナップショットを読み込み中…",
  "controlRoom.error.title": "スナップショットを読み込めませんでした。",
  "controlRoom.error.hint.before": "dashboard/control-room の生成ワークフローがまだ実行されていない可能性があります（",
  "controlRoom.error.hint.after": "）。",

  "objective.title": "現在の目標 (Current Objective)",
  "objective.source": "出典:",

  "next.title": "次に着手すべきタスク (Next Executable Task)",
  "next.empty": "現時点で「未着手・PR未作成」の推奨タスクはありません。",
  "next.badge": "推奨 (Recommendation) — 確定した事実ではありません",
  "next.item": "WORK_QUEUE.md item",
  "next.evidence": "根拠:",

  "drift.title": "ロードマップの食い違い ({count})",
  "drift.empty": "現在検出されている食い違いはありません。",
  "drift.badge": "DRIFT DETECTED",

  "blockers.title": "ブロッカー ({count})",
  "blockers.empty": "現在検出されているブロッカーはありません。",
  "blockers.affects": "影響範囲: {list}",

  "tasks.title": "タスク ({count})",
  "tasks.active": "進行中 — PRあり (Active work)",
  "tasks.activeEmpty": "現在進行中のPR付きタスクはありません。",
  "tasks.prePr": "PR未作成 — 計画済み/着手可能 (Pre-PR work)",
  "tasks.prePrEmpty": "PR未作成のタスクはありません。",
  "tasks.done": "完了・検証済み・保留",
  "tasks.doneEmpty": "完了したタスクはまだありません。",
  "tasks.recommended": "推奨タスク",
  "tasks.unknownRepo": "リポジトリ不明",
  "tasks.pr.merged": "マージ済み",
  "tasks.pr.draft": "Draft",
  "tasks.pr.open": "Open",
  "tasks.pr.closed": "Closed",
  "tasks.pr.notFound": "見つかりません",
  "tasks.pr.ambiguous": "リポジトリ特定不可",
  "tasks.pr.unresolved": "未解決",

  "phases.title": "ロードマップ — Phase ({count})",
  "phases.dependsOn": "依存: {list}",

  "crRepos.title": "リポジトリ ({count})",
  "crRepos.unreachable": "{count}件のリポジトリに到達できませんでした：",
  "crRepos.contract": "Contract: {value}",
  "crRepos.provides": "provides: {value}",
  "crRepos.published": "公開済み",
  "crRepos.unpublished": "未公開",
  "crRepos.unknown": "不明",
  "crRepos.openPrs": "Open PR: {count}",
  "crRepos.openIssues": "Open Issue: {count}",
  "crRepos.maturity": "Maturity: Lv{level}",
  "crRepos.dependsOn": "依存先: {list}",

  "si.research": "Research: {count}件",
  "si.verification": "Verification: {count}件（System Intelligence側の該当フェーズが未実装のため、現時点では常に0件）",

  "verification.title": "検証済み ({count})",
  "verification.empty": "WORK_QUEUE.mdが「検証済み」と明記している項目は現在ありません。",

  "lifecycle.PLANNED": "計画済み",
  "lifecycle.READY": "着手可能",
  "lifecycle.IN_PROGRESS": "進行中",
  "lifecycle.BLOCKED": "ブロック中",
  "lifecycle.DRAFT_PR": "Draft PR",
  "lifecycle.CI": "CI実行中",
  "lifecycle.REVIEW": "レビュー中",
  "lifecycle.WAITING_APPROVAL": "承認待ち",
  "lifecycle.MERGED": "マージ済み",
  "lifecycle.VERIFIED": "検証済み",
  "lifecycle.DONE": "完了",
  "lifecycle.DEFERRED": "保留",
  "lifecycle.UNKNOWN": "不明",
};

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ja };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translator(lang: Lang): Translate {
  const table = MESSAGES[lang];
  return (key, vars) => {
    const text = table[key];
    return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
  };
}

/** The landing page's rule: the URL first (an explicit `?lang=en` also counts), then the
 * stored choice, then English. Storage can throw (private mode, blocked site data). */
export function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  let choice: string | null = new URLSearchParams(window.location.search).get("lang");
  if (!choice) {
    try {
      choice = window.localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      choice = null;
    }
  }
  return choice === "ja" ? "ja" : "en";
}

/** Remember the choice the way the landing page does: write the shared key, and put
 * `?lang=ja` in the URL (or remove the param for English) without a navigation. */
export function persistLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Storage blocked: the URL still carries the choice.
  }
  const url = new URL(window.location.href);
  if (lang === "ja") url.searchParams.set("lang", "ja");
  else url.searchParams.delete("lang");
  window.history.replaceState(window.history.state, "", url);
}

/** A same-site link that opens in the active language, so a shared link keeps it. */
export function withLang(href: string, lang: Lang): string {
  return lang === "ja" ? `${href}${href.includes("?") ? "&" : "?"}lang=ja` : href;
}

export type I18n = {
  lang: Lang;
  locale: string;
  t: Translate;
  setLang: (lang: Lang) => void;
};

/** Without a provider (a component rendered on its own, e.g. in a unit test) the UI is
 * English, the same as a first visit. */
export const I18nContext = createContext<I18n>({ lang: "en", locale: LOCALES.en, t: translator("en"), setLang: () => {} });

export function useI18n(): I18n {
  return useContext(I18nContext);
}
