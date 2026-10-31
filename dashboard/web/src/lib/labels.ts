/**
 * Status vocabulary for the UI, resolved through the active language (lib/i18n.ts).
 * Scope is deliberately narrow: only this app's own static labels are translated.
 * Real GitHub-sourced content (PR titles, commit messages, repo slugs) and the two
 * ecosystem-state JSON files (docs/ecosystem/registry.json's `role`,
 * capability-status.json's `evidence`/`detail` strings) are shown as generated: they
 * mirror this project's English-language prose docs (CROSS_REPO_STATUS.md,
 * CURRENT_STATE.md, ...) exactly (ADR-011), and translating them here would silently
 * fork that mirror.
 */
import type { Bottleneck, CiConclusion, MaturityLevel, RepoType } from "@ecosystem/types";
import { UNKNOWN } from "@ecosystem/types";
import type { MessageKey, Translate } from "./i18n.js";

export function maturityLevelName(t: Translate, level: MaturityLevel): string {
  return t(`maturity.${level}`);
}

export function repoTypeLabel(t: Translate, type: RepoType): string {
  return t(`repoType.${type}`);
}

const CI_KEYS: Record<string, MessageKey> = {
  success: "ci.success",
  failure: "ci.failure",
  neutral: "ci.neutral",
  cancelled: "ci.cancelled",
  timed_out: "ci.timed_out",
  action_required: "ci.action_required",
  in_progress: "ci.in_progress",
};

export function ciConclusionLabel(t: Translate, conclusion: CiConclusion): string {
  if (conclusion === UNKNOWN) return t("ci.UNKNOWN");
  const key = CI_KEYS[conclusion];
  return key ? t(key) : t("ci.other", { value: conclusion });
}

export function bottleneckKindLabel(t: Translate, kind: Bottleneck["kind"]): string {
  return t(`bottleneck.${kind}`);
}
