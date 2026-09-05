# Ecosystem Maturity Model

**Status: PROPOSED, 2026-09-05.** No maturity ladder existed anywhere in this project's
documents before this one (`ROADMAP.md` describes OS-kernel phases, not per-repository
maturity; `CAPABILITY_MATRIX.md` records which Capability ids exist, not how mature a
Skill is as a whole). This document formalizes one, written specifically so the
Ecosystem Dashboard (`dashboard/`) has something real to render instead of an invented
progress percentage. Every level below is defined by **checkable evidence**, and every
piece of evidence is tagged with whether the Dashboard's aggregator can check it
automatically today, or whether it currently depends on a human/agent-maintained
document (`docs/ecosystem/capability-status.json`) until a more automatic source exists.

## Why a ladder, and why this shape

The task that produced this document explicitly forbade computing progress from commit
counts, file counts, lines of code, stars, or other activity metrics, and required that
an "overall progress %" (if used at all) have an exact, documented calculation. A
maturity **level per repository**, backed by named evidence, satisfies that requirement
without inventing a single scalar: the Dashboard can show "how many repos are at each
level" (a real histogram of real facts) instead of "68% done" (a number nobody could
audit). This mirrors the CURRENT/EXPERIMENTAL/PLANNED/VISION/UNKNOWN tagging convention
already used throughout `docs/` (`DESIGN_SYSTEM.md` §2) — a maturity level is that same
discipline applied per-repository instead of per-claim.

## The levels

A repository's maturity is the **highest level for which every piece of that level's
evidence holds**, not merely one item — level 3 requires everything level 1 and 2 need,
plus its own evidence. A repository can legitimately sit at level 0 (e.g. a Skill only
proposed in an issue, not yet scaffolded) or skip evaluation entirely if it isn't listed
in `docs/ecosystem/registry.json` at all.

| Level | Name | Evidence required | How it's checked |
|---|---|---|---|
| 0 | **Proposed** | Listed in `registry.json` (or a real GitHub issue/discussion proposing it); no repository exists yet, or the repository exists but is empty/scaffolding-only. | Automatic: GitHub API repo existence + non-empty default branch. |
| 1 | **Scaffolded** | Repository exists, has a README, has at least one real source file (not just scaffolding). | Automatic: GitHub Contents API. |
| 2 | **Contract Published** | Exposes a `contract`/`skill --json`-equivalent entrypoint per `SKILL_SPEC.md` §2, documented in its own README/`docs/contract.md`, **and** has a passing CI workflow on its default branch. | Automatic for CI (GitHub Actions API, latest run conclusion on the default branch). Contract-entrypoint existence is **not** automatically verified (would require cloning and running the Skill) — sourced from `docs/ecosystem/capability-status.json` until a lighter-weight signal exists (e.g. a well-known file the aggregator can fetch via the Contents API without executing anything). |
| 3 | **Capability Declared** | Publishes a `provides[]` field (Capability ids) in its Capability Contract, per `docs/ROADMAP.md` Phase 2 and the `provides` rollout tracked in `ECOSYSTEM_CHANGELOG.md`. | Sourced from `docs/ecosystem/capability-status.json` (`provides_published: true`), which this project updates every time a `provides` PR merges — see `ECOSYSTEM_CHANGELOG.md`'s merge tracker, the authoritative event this field mirrors. Not independently automatic yet (same reason as level 2). |
| 4 | **OS Integrated** | `video-production-agent` has a real, working adapter for it (a `SkillPackage`/`ToolSpec` registration in `src/video_agent/skills/registry.py`'s `default_registry()`, confirmed by reading the adapter module, per `docs/ecosystem/CURRENT_STATE.md`'s audit). | Currently sourced from `docs/ecosystem/capability-status.json` (`os_integration: "integrated"`), populated from this project's own investigation (`WORK_QUEUE.md` item 1). A fully automatic check would require the aggregator to fetch and parse `video-production-agent`'s registry source on every run — deferred; see dashboard/README.md's "known gaps." |
| 5 | **Verified End-to-End** | Exercised with real media as part of `video-production-agent`'s own demonstrated pipeline (its README's real command sequence, or its own CI running a real-media test), not just unit-tested in isolation. | Sourced from `docs/ecosystem/capability-status.json`, evidenced by a specific ADR or test file reference (never asserted without one). |
| 6 | **Distributed** | Published as an installable package with a real version (`npm`/`PyPI`) that `skill_version`/`contract_version` can be checked against, per `VERSIONING.md`. | Automatic where the package registry has a public lookup API (e.g. npm registry for `ffmpeg-skill`); `UNKNOWN` otherwise, never assumed. |

## What counts as evidence, precisely

- **Automatic** evidence is fetched fresh on every aggregator run directly from GitHub's
  API (or a package registry's API) — it can never go stale in a way the Dashboard
  itself doesn't immediately reflect on the next run.
- **Documented** evidence (levels 2's contract-entrypoint half, 3, 4, 5) is read from
  `docs/ecosystem/capability-status.json`, a structured, version-controlled file this
  project's own architect (human or agent) updates in the same commit that establishes
  the fact — e.g. the `provides` rollout's merge tracker entry in
  `ECOSYSTEM_CHANGELOG.md` and the `capability-status.json` update happen together, not
  as separate, driftable steps. This is **not** a second competing database: it is a
  structured, machine-readable mirror of facts this project is already required to
  record in prose (`CROSS_REPO_STATUS.md`, `CURRENT_STATE.md`, `CAPABILITY_MATRIX.md`)
  — see `docs/adr/ADR-011-ecosystem-dashboard.md` for why this is the correct boundary
  rather than either (a) the Dashboard inventing its own tracking, or (b) the Dashboard
  trying to fully automate facts that currently require reading source code and ADRs to
  establish correctly.
- Every field the aggregator cannot support with real evidence renders as **UNKNOWN**,
  never a guess, never a default of "0" or "not started." A repository is UNKNOWN at a
  level rather than assumed to fail it.

## Deliberately not part of this model

- **No single ecosystem-wide percentage.** The Dashboard's OS Overview shows a
  **distribution** — how many of the N known repositories sit at each level — never a
  single number computed by averaging levels or weighting them, since any such weighting
  would be exactly the kind of invented calculation this document exists to avoid.
- **No velocity/trend metrics** (e.g. "3 repos leveled up this week") in v1 — this would
  require storing historical snapshots, which is real, legitimate future work
  (`dashboard/README.md`'s gaps list) but out of scope until snapshot history actually
  exists to compute it from.
- **No cross-repository weighting** (e.g. "ffmpeg-skill counts more because 6 Skills
  depend on it"). `DEPENDENCY_GRAPH.md`/`registry.json`'s `depends_on` field is shown
  as-is in the Dashboard's ecosystem graph; it does not feed into a maturity score.
