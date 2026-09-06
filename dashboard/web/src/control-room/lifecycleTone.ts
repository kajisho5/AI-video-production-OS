import type { LifecycleStatus } from "@ecosystem/control-room-types";
import type { ChipTone } from "../lib/statusStyle.js";

export function lifecycleTone(status: LifecycleStatus): ChipTone {
  if (status === "UNKNOWN") return "unknown";
  if (status === "DONE" || status === "VERIFIED" || status === "MERGED") return "ok";
  if (status === "BLOCKED") return "bad";
  if (status === "DEFERRED") return "warn";
  return "neutral"; // PLANNED, READY, IN_PROGRESS, DRAFT_PR, CI, REVIEW, WAITING_APPROVAL
}

const JA_LABELS: Record<LifecycleStatus, string> = {
  PLANNED: "計画済み",
  READY: "着手可能",
  IN_PROGRESS: "進行中",
  BLOCKED: "ブロック中",
  DRAFT_PR: "Draft PR",
  CI: "CI実行中",
  REVIEW: "レビュー中",
  WAITING_APPROVAL: "承認待ち",
  MERGED: "マージ済み",
  VERIFIED: "検証済み",
  DONE: "完了",
  DEFERRED: "保留",
  UNKNOWN: "不明",
};

export function lifecycleLabelJa(status: LifecycleStatus): string {
  return JA_LABELS[status];
}
