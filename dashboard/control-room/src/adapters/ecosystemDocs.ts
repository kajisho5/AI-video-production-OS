/**
 * Parses this repository's own existing, authoritative documents into the Control
 * Room's read model. This module never invents structure a document doesn't have --
 * see each function's own comment for exactly what is (and is not) extracted, and
 * docs/ecosystem/OS_USABILITY_FLOW.md / the investigation that preceded this module
 * for why each document was judged parseable to the degree it is here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Evidence, Phase, RoadmapDrift, Task } from "../types.js";
import { UNKNOWN } from "../types.js";

export interface RepoRoot {
  root: string; // absolute path to a checkout of kajisho5/AI-video-production-OS
}

function read(root: string, relPath: string): string {
  return readFileSync(path.join(root, relPath), "utf-8");
}

/** README.md's own "## What this is, in one sentence" section, quoted verbatim --
 * never paraphrased, since the Objective must be the project's own words. */
export function extractObjective(root: string): { statement: string; evidence: Evidence } {
  const readme = read(root, "README.md");
  const match = readme.match(/## What this is, in one sentence\s*\n\n([\s\S]+?)\n\n##/);
  const statement = match ? match[1].replace(/\s+/g, " ").trim() : UNKNOWN;
  return {
    statement,
    evidence: { source: "doc", locator: "README.md#what-this-is-in-one-sentence", detail: match ? "extracted verbatim" : "section not found -- README.md structure changed" },
  };
}

// Both labels can wrap across several lines before their closing `**` (ROADMAP.md's
// own prose style), so these match across newlines rather than assuming one line.
const STATUS_LINE_RE = /\*\*Status:\s*([\s\S]+?)\*\*/;
const DEPENDS_LINE_RE = /\*\*Depends on:?\s*([\s\S]+?)\*\*/i;
const PHASE_HEADING_RE = /^## (Phase \d+) — (.+)$/;

/** Maps a ROADMAP.md phase's free-text Status line to the closed LifecycleStatus
 * vocabulary via a small set of literal phrase checks -- never a generic NLP guess.
 * Anything not matching a known phrase stays UNKNOWN rather than being forced into
 * one of the known buckets. */
function classifyPhaseStatus(statusText: string): Phase["status"] {
  const t = statusText.toLowerCase();
  if (t.includes("implemented")) return "DONE";
  if (t.includes("substantially complete")) return "DONE";
  if (t.includes("in progress")) return "IN_PROGRESS";
  if (t.includes("not started") || t.includes("not yet")) return "PLANNED";
  return "UNKNOWN";
}

/** docs/ROADMAP.md: one Phase per `## Phase N — <title>` heading, with its own
 * `**Status: ...**` and `**Depends on: ...**` lines (present for every phase as of
 * this writing -- see the investigation that preceded this module). The
 * `dependsOnPhaseIds` extraction only recognizes the literal phrase "Phase N" inside
 * that line; a phase whose dependency text doesn't name another phase by number
 * (e.g. Phase 0's "nothing else") correctly yields an empty array, not a guess. */
export function parseRoadmapPhases(root: string): Phase[] {
  const text = read(root, "docs/ROADMAP.md");
  const lines = text.split("\n");
  const phases: Phase[] = [];
  let current: { id: string; title: string; startLine: number } | null = null;
  const sections: Array<{ id: string; title: string; body: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(PHASE_HEADING_RE);
    if (headingMatch) {
      if (current) {
        sections.push({ id: current.id, title: current.title, body: lines.slice(current.startLine, i).join("\n") });
      }
      current = { id: headingMatch[1], title: headingMatch[2].trim(), startLine: i + 1 };
    }
  }
  if (current) {
    sections.push({ id: current.id, title: current.title, body: lines.slice(current.startLine).join("\n") });
  }

  for (const section of sections) {
    const statusMatch = section.body.match(STATUS_LINE_RE);
    const dependsMatch = section.body.match(DEPENDS_LINE_RE);
    const statusText = statusMatch ? statusMatch[1].replace(/\s+/g, " ").trim() : UNKNOWN;
    const dependsText = dependsMatch ? dependsMatch[1] : "";
    const dependsOnPhaseIds = Array.from(dependsText.matchAll(/Phase (\d+)/g)).map((m) => `Phase ${m[1]}`);
    phases.push({
      id: section.id,
      title: section.title,
      status: statusMatch ? classifyPhaseStatus(statusText) : "UNKNOWN",
      statusText,
      dependsOnPhaseIds,
      evidence: [{ source: "doc", locator: `docs/ROADMAP.md#${section.id.toLowerCase().replace(" ", "-")}`, detail: "Status/Depends-on lines parsed from this phase's own section" }],
    });
  }
  return phases;
}

const WORK_QUEUE_HEADING_RE = /^## (\d+)\.\s+(?:~~(.+?)~~|(.+?))\s*(?:—\s*(.+))?$/;
const KNOWN_STATUS_WORDS = ["DONE", "LIVE", "RESOLVED", "IMPLEMENTED"] as const;

function classifyWorkQueueStatus(struckThrough: boolean, suffix: string | undefined, plainTitle: string): { status: Task["status"]; marker: string | null } {
  if (!suffix) {
    // No heading-suffix marker at all. A strikethrough alone (no suffix text) still
    // signals "done" by this document's own convention; otherwise this generator
    // does not guess -- it reports UNKNOWN, and (per DEFERRED below) recognizes the
    // one explicit deferral phrase this document actually uses today.
    if (/VISION-tier, not yet actionable/i.test(plainTitle)) return { status: "DEFERRED", marker: null };
    return { status: struckThrough ? "DONE" : "UNKNOWN", marker: null };
  }
  const word = KNOWN_STATUS_WORDS.find((w) => suffix.toUpperCase().startsWith(w));
  if (!word) return { status: struckThrough ? "DONE" : "UNKNOWN", marker: suffix };
  if (/draft pr/i.test(suffix)) return { status: "DRAFT_PR", marker: suffix };
  if (word === "LIVE") return { status: "VERIFIED", marker: suffix };
  if (word === "DONE" || word === "RESOLVED") return { status: "DONE", marker: suffix };
  return { status: "DONE", marker: suffix }; // IMPLEMENTED with no "Draft PR" text: treated as shipped
}

/** docs/ecosystem/WORK_QUEUE.md: one Task per `## N. <title>` item. Status is
 * derived ONLY from the document's own heading-suffix convention
 * (`— DONE/LIVE/RESOLVED/IMPLEMENTED ...`) or explicit strikethrough -- an item
 * with neither is reported as UNKNOWN, never assumed to be "not started" or "in
 * progress" (see NEXT-TASK selection in normalize.ts for how an open item is
 * recommended without asserting its status as fact). PR citations
 * ("PR #N", optionally preceded by a registry-known repo name) are extracted
 * for `prAdapter.ts` to resolve against live GitHub state. */
export function parseWorkQueueTasks(root: string, knownRepoNames: string[]): Task[] {
  const text = read(root, "docs/ecosystem/WORK_QUEUE.md");
  const lines = text.split("\n");
  const items: Array<{ id: string; struckThrough: boolean; plainTitle: string; suffix?: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(WORK_QUEUE_HEADING_RE);
    if (m) {
      items.push({ id: m[1], struckThrough: m[2] !== undefined, plainTitle: (m[2] ?? m[3] ?? "").trim(), suffix: m[4]?.trim(), startLine: i + 1 });
    }
  }

  const tasks: Task[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const endLine = idx + 1 < items.length ? items[idx + 1].startLine - 1 : lines.length;
    const body = lines.slice(item.startLine, endLine).join("\n");
    const { status, marker } = classifyWorkQueueStatus(item.struckThrough, item.suffix, item.plainTitle);

    const phaseMention = body.match(/Phase (\d+)/);
    const pullRequests = extractPullRequestCitations(body, knownRepoNames);

    tasks.push({
      id: item.id,
      title: item.plainTitle,
      source: "WORK_QUEUE.md",
      phaseId: phaseMention ? `Phase ${phaseMention[1]}` : UNKNOWN,
      epic: UNKNOWN,
      milestone: UNKNOWN,
      status,
      statusMarker: marker,
      dependencies: [],
      blockers: [],
      pullRequests: pullRequests.map((c) => ({ ...c, resolution: "unresolved_error" as const })), // overwritten by normalize.ts once resolvePullRequestCitations runs
      evidence: [{ source: "doc", locator: `docs/ecosystem/WORK_QUEUE.md#item-${item.id}`, detail: `heading: "${item.plainTitle}"${marker ? ` — ${marker}` : ""}` }],
      isRecommendedNext: false,
    });
  }
  return tasks;
}

/** Two extraction patterns, in order of confidence:
 *
 * 1. `owner/repo#N` (how WORK_QUEUE.md actually cites most PRs, usually as a
 *    Markdown link target, e.g. "kajisho5/video-production-agent#27") -- the repo
 *    is stated unambiguously in the citation itself, no heuristic needed.
 * 2. A bare "PR #N" mention, attributed to a repo name only if one of
 *    registry.json's known repo names appears within 120 characters before it in
 *    the same document -- a best-effort text-proximity heuristic, explicitly not
 *    presented as fact. Otherwise the citation is kept with no repo (surfaced as
 *    an "ambiguous_repo" resolution by the caller), never guessed at.
 *
 * Both are deduplicated by (repo, number). */
export function extractPullRequestCitations(text: string, knownRepoNames: string[]): Array<{ repoSlug: string; number: number; citedText: string }> {
  const out: Array<{ repoSlug: string; number: number; citedText: string }> = [];
  const seen = new Set<string>();

  const slugRe = /(?:[\w.-]+)\/([\w.-]+)#(\d+)/g;
  let sm: RegExpExecArray | null;
  while ((sm = slugRe.exec(text))) {
    const repoSlug = sm[1];
    const number = Number(sm[2]);
    const key = `${repoSlug}#${number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ repoSlug, number, citedText: text.slice(Math.max(0, sm.index - 20), sm.index + sm[0].length + 20).trim() });
  }

  const re = /PR\s*#(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const windowStart = Math.max(0, m.index - 120);
    const window = text.slice(windowStart, m.index);
    let bestRepo: string | null = null;
    let bestPos = -1;
    for (const name of knownRepoNames) {
      const pos = window.lastIndexOf(name);
      if (pos > bestPos) {
        bestPos = pos;
        bestRepo = name;
      }
    }
    const number = Number(m[1]);
    const key = `${bestRepo ?? UNKNOWN}#${number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ repoSlug: bestRepo ?? UNKNOWN, number, citedText: text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 20).trim() });
  }
  return out;
}

/** docs/ecosystem/DECISION_LOG.md: detects duplicate decision IDs (`## D7` used
 * twice, as of this writing) and surfaces it as a RoadmapDrift entry -- a real
 * structural inconsistency in the source document itself, not an invented one. */
export function detectDecisionLogDuplicateIds(root: string): RoadmapDrift[] {
  const text = read(root, "docs/ecosystem/DECISION_LOG.md");
  const lines = text.split("\n");
  const seen = new Map<string, number[]>();
  lines.forEach((line, i) => {
    const m = line.match(/^## (D\d+) — /);
    if (m) {
      const arr = seen.get(m[1]) ?? [];
      arr.push(i + 1);
      seen.set(m[1], arr);
    }
  });
  const drifts: RoadmapDrift[] = [];
  for (const [id, lineNumbers] of seen) {
    if (lineNumbers.length > 1) {
      drifts.push({
        id: `decision-log-duplicate-${id}`,
        summary: `DECISION_LOG.md uses the decision id "${id}" for ${lineNumbers.length} different, unrelated decisions.`,
        sourceA: { source: "doc", locator: `docs/ecosystem/DECISION_LOG.md:${lineNumbers[0]}`, detail: `first "${id}" heading` },
        sourceB: { source: "doc", locator: `docs/ecosystem/DECISION_LOG.md:${lineNumbers[1]}`, detail: `second "${id}" heading` },
        detectedAt: new Date().toISOString(),
      });
    }
  }
  return drifts;
}
