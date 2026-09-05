import type { ChipTone } from "../lib/statusStyle.js";

/** The single place `UNKNOWN` becomes visible UI. Every status-shaped value in this
 * app should render through this component (or reuse its `.status-chip` class) so a
 * user can never mistake "we don't know" for "no" or "0" -- the task's explicit
 * requirement that UNKNOWN be distinguishable from a measured value. */
export function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
  return <span className={`status-chip ${tone}`}>{label}</span>;
}
