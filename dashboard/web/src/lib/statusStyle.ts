import { UNKNOWN } from "@ecosystem/types";
import type { CiConclusion } from "@ecosystem/types";

export type ChipTone = "ok" | "warn" | "bad" | "unknown" | "neutral";

export function ciTone(conclusion: CiConclusion): ChipTone {
  if (conclusion === UNKNOWN) return "unknown";
  if (conclusion === "success") return "ok";
  if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "action_required") return "bad";
  if (conclusion === "in_progress") return "neutral";
  return "warn"; // neutral/cancelled
}

export function booleanTone(value: boolean | typeof UNKNOWN): ChipTone {
  if (value === UNKNOWN) return "unknown";
  return value ? "ok" : "warn";
}
