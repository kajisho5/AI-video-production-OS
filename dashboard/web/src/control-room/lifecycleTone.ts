import type { LifecycleStatus } from "@ecosystem/control-room-types";
import type { ChipTone } from "../lib/statusStyle.js";
import type { Translate } from "../lib/i18n.js";

export function lifecycleTone(status: LifecycleStatus): ChipTone {
  if (status === "UNKNOWN") return "unknown";
  if (status === "DONE" || status === "VERIFIED" || status === "MERGED") return "ok";
  if (status === "BLOCKED") return "bad";
  if (status === "DEFERRED") return "warn";
  return "neutral"; // PLANNED, READY, IN_PROGRESS, DRAFT_PR, CI, REVIEW, WAITING_APPROVAL
}

export function lifecycleLabel(t: Translate, status: LifecycleStatus): string {
  return t(`lifecycle.${status}`);
}
