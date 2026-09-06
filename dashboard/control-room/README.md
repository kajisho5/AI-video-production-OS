# Ecosystem Control Room

**Status: CURRENT / IMPLEMENTED, Phase 1 (read-only control plane), 2026-09-06.**

A cross-ecosystem **development control plane / read model** answering questions the
[Ecosystem Dashboard](../README.md) deliberately does not: what are we building, where
are we in the roadmap, what work exists before a PR, what's actively being implemented,
what's blocked and why, which PR/CI/review state corresponds to which task, what's the
next executable task, and what does System Intelligence recommend investigating.

## The one rule that shapes everything else

**The Control Room is not a second source of truth.** It never introduces a new,
independently-maintained roadmap or task database. Every field in
`ControlRoomSnapshot` (`src/types.ts`) is derived, at generation time, from documents
and APIs that are already authoritative in this ecosystem:

- `README.md`'s own "What this is, in one sentence" section → the Objective, quoted verbatim.
- `docs/ROADMAP.md`'s `## Phase N — <title>` sections → Phases.
- `docs/ecosystem/WORK_QUEUE.md`'s `## N. <title>` items → Tasks (this document has no
  Epic/Milestone concept, so those fields are `UNKNOWN` for every Task, never invented).
- `docs/ecosystem/DECISION_LOG.md` → checked for structural issues (e.g. a duplicate
  decision id), surfaced as roadmap drift, never silently fixed.
- `docs/ecosystem/registry.json` / `capability-status.json` → repositories, dependencies.
- `dashboard/web/public/data/ecosystem-snapshot.json` (the Ecosystem Dashboard's own
  aggregator output) → live per-repo GitHub facts (PR/issue counts, CI, maturity). Never
  re-fetched or re-computed here — reused as-is, so there is exactly one live answer to
  "what does GitHub say about this repo," not two that could disagree.
- Live GitHub API calls (`pulls.get`) → **only** for the specific PR numbers
  WORK_QUEUE.md's own text cites (e.g. `kajisho5/video-production-agent#27`), to check
  whether the document's claim ("Draft PR open") still matches reality.
- An on-disk [System Intelligence](https://github.com/kajisho5/system-intelligence)
  snapshot directory (`SI_SNAPSHOT_DIR` env var), if one is configured — the only
  documented, working export contract that project has today
  (`Snapshot.write_to_directory`: `manifest.json` + one JSON array file per collection).
  `recommendations.json`/`research.json`/`verification.json`/`approvals.json` are
  reported as real, honest zeros when present but empty (those SI pipeline stages are
  documented upstream stubs, not a gap in this adapter) and as "not configured" when no
  directory is set at all — the two are never conflated.

If a value cannot be derived from one of the above, it is `UNKNOWN` — never guessed,
and never silently converted into "not started," "blocked," or "0%."

## Architecture

```
README.md, docs/ROADMAP.md, docs/ecosystem/*.md, docs/ecosystem/*.json
dashboard/web/public/data/ecosystem-snapshot.json (Dashboard's own output, reused)
live GitHub API (only for PR numbers WORK_QUEUE.md itself cites)
System Intelligence snapshot directory (optional, on disk)
        |
        v
dashboard/control-room/   (Node + TypeScript, runs ONLY in CI, like dashboard/aggregator)
        |  produces one normalized ControlRoomSnapshot JSON (src/types.ts)
        v
dashboard/web/public/data/control-room-snapshot.json
        |  plain static file, no auth
        v
dashboard/web/control-room.html + src/control-room/   (a second page in the same Vite app)
        |
        v
  viewer's browser, served at /control-room.html alongside the Dashboard at /
```

- **`src/types.ts`** — the canonical read model: `Objective`, `Phase`, `Task`,
  `RepositoryState`, `Dependency`, `Blocker`, `PullRequestRef`/`PullRequestState`,
  `VerificationRecord`, `IntelligenceFinding`/`IntelligenceRecommendation`,
  `RoadmapDrift`, `NextExecutableTaskRecommendation`. Every claim carries an `Evidence`
  (`source` + `locator` + `detail`) — nothing is asserted without one.
- **`src/adapters/ecosystemDocs.ts`** — parses `ROADMAP.md`/`WORK_QUEUE.md`/
  `DECISION_LOG.md` and extracts PR citations from their text. Deliberately narrow:
  only the structural signals the investigation preceding this module found to be
  reliably parseable (heading-suffix completion markers, `**Status:**`/`**Depends
  on:**` labels, `owner/repo#N` / `PR #N` citations) — free-form prose bodies are left
  as prose, never force-parsed into a fake schema.
- **`src/adapters/githubState.ts`** — reuses the Dashboard's own generated snapshot for
  per-repo facts; makes its own narrow, additional `pulls.get` calls only for
  specifically-cited PR numbers.
- **`src/adapters/systemIntelligence.ts`** — reads an SI snapshot directory if
  configured; never imports or duplicates SI's own analysis code.
- **`src/normalize.ts`** — the only module that computes derived values (next
  executable task, phase-dependency blockers, Task-vs-PR roadmap drift), always from
  the adapters' own parsed facts, with the recommendation/inference distinction the
  task's own instructions require.
- **`src/index.ts`** — entrypoint (`npm run generate`).

## Running it

```bash
cd dashboard/control-room
npm ci
GITHUB_TOKEN=<token> npm run generate        # resolves cited PR numbers against live GitHub state
SI_SNAPSHOT_DIR=/path/to/si-snapshot npm run generate   # also include a System Intelligence snapshot
```

Writes `dashboard/web/public/data/control-room-snapshot.json` by default (override with
`OUTPUT_PATH`). CI (`.github/workflows/dashboard.yml`) runs this automatically alongside
`dashboard/aggregator`, before building `dashboard/web`.

## What Phase 1 deliberately does not do

Per the task's own scope boundary: no automatic PR creation, no automatic merge, no
automatic roadmap editing, no LLM-based fact-finding (every deterministic fact — does a
PR exist, is it draft, did CI pass — comes from a real API call or a real file read,
never a guess), no automatic execution of an SI proposal, no fake health/risk/completion
scores. Epic and Milestone levels are `UNKNOWN` for every Task because
`WORK_QUEUE.md` has no such concept — a later phase could add them only if a real
source starts distinguishing them.

## Directory map

```
dashboard/control-room/
  src/
    types.ts                      canonical read model
    adapters/
      ecosystemDocs.ts             README/ROADMAP/WORK_QUEUE/DECISION_LOG parsing
      githubState.ts                reuses ecosystem-snapshot.json + resolves cited PRs
      systemIntelligence.ts          reads an SI snapshot directory, if configured
    normalize.ts                   next-task / blockers / roadmap-drift computation
    index.ts                       entrypoint (`npm run generate`)
  test/                            42 tests, no network beyond what's mocked
```

The UI lives in `dashboard/web/control-room.html` + `dashboard/web/src/control-room/`,
reusing the Dashboard's own `Section`/`StatusChip` components and `styles/` — a second
page in the same Vite app, not a separate deployment.
