# Handoff

**Read this first.** One page, so a fresh session (or a human returning after a break) can
pick up without chat history. Details and evidence live in the other four files in this
directory; this page only orients and points.

## What this project is

`AI-video-production-OS`: the architecture, the Capability/Skill/Provider/Runtime model,
and (as of Phase 1) a small real `registry/` library, for an ecosystem of 10 independent
video-processing Skill repositories plus one orchestrating Agent
(`video-production-agent`). See the main `README.md` and `docs/ARCHITECTURE.md` for the
full design; this `docs/ecosystem/` directory is operational state, not architecture.

## Read in this order

1. **This file** — orientation.
2. **`CURRENT_STATE.md`** — what's CURRENT/EXPERIMENTAL/PLANNED/VISION/UNKNOWN, ecosystem-wide.
3. **`CROSS_REPO_STATUS.md`** — per-repo detail, PR/CI state, what depends on what.
4. **`WORK_QUEUE.md`** — prioritized next work, and why each item is where it is.
5. **`DECISION_LOG.md`** — judgment calls made and why, so they aren't re-litigated by accident.

Also load: `docs/ECOSYSTEM_CHANGELOG.md` (factual change log, append-only, newest first) and
`docs/ROADMAP.md` (the original phase plan — now partially superseded, see below).

## The single most important thing to know

`video-production-agent` is **much further along** than this project's own earlier
architecture documents assumed. It has a real, tested, working end-to-end production
pipeline integrating all 9 Skills, and it independently solved the Skill→Tool selection
problem `docs/ROADMAP.md` Phase 4 describes as future work — with its own mechanism, not
this project's `provides`/`registry/` system. The two are still not connected — and, as of
2026-09-06's exhaustive investigation (`WORK_QUEUE.md` item 1, `DECISION_LOG.md` D8), that
is now a confirmed, evidenced conclusion rather than an open question: Phase 4 stays
scoped as-is (nothing found contradicts it), and the concrete near-term step is a small,
separate, read-only diagnostic (`WORK_QUEUE.md` item 8) — not a Phase 4 rewrite, and not
something to build inside `video-production-agent` from this project. Read
`CURRENT_STATE.md`'s "RESOLVED"/"UNKNOWN" sections before touching registry/discovery work
again.

## What's actively in flight right now

- The Phase 2 `provides` rollout: **complete** — all 10 Skills' PRs merged (see
  `docs/ECOSYSTEM_CHANGELOG.md`'s merge tracker and `CROSS_REPO_STATUS.md`).
- No PR is open against `video-production-agent` from this project, and per the conclusion
  above, none is currently planned — `WORK_QUEUE.md` item 8's diagnostic is a proposal for
  that repository's own maintainers, not a queued task here.
- **`dashboard/`** (Ecosystem Dashboard, built 2026-09-05): read-only, mobile-first, PWA
  web dashboard over the ecosystem's real GitHub state. **Live**, not just built: GitHub
  Pages was manually enabled 2026-09-06 and the deploy workflow has run successfully —
  `https://kajisho5.github.io/AI-video-production-OS/`. 61 tests, all passing. See
  `dashboard/README.md`, `docs/adr/ADR-011-ecosystem-dashboard.md`,
  `docs/ecosystem/MATURITY_MODEL.md`, and `WORK_QUEUE.md` item 7 for the small remaining
  real gaps (PR mergeability check is bounded to 8 per repo, no snapshot history).
- `registry/` (Phase 1) is now fully complete, including the standalone JSON Schema file
  (`registry/capability_contract.schema.json`) — see `WORK_QUEUE.md` item 4.
- `ffmpeg-skill` PR #22 (FFmpeg 8+/Windows caption and color compatibility) merged
  2026-09-06 after this project reviewed it, found and fixed one remaining issue
  (`scripts/_common.py`'s install hint still recommended the broken `brew install ffmpeg`
  command the PR itself proved insufficient), and confirmed CI green on all three OSes.

## Standing behavioral context (from the user, applies across sessions)

- Operate autonomously: observe → understand → identify gaps → prioritize → plan →
  implement → test → review → update state → select next work, without asking "should I
  continue?" or "what next?" — this file and `WORK_QUEUE.md` exist specifically so that
  question never needs to be asked.
- Stop and ask only for genuinely irreversible/dangerous actions (deleting repos or data,
  exposing secrets, financial/paid actions, license changes, creating a new repository,
  large breaking architecture changes). Everything else: proceed and report.
- Never invent functionality; always distinguish CURRENT/EXPERIMENTAL/PLANNED/VISION/UNKNOWN.
- Prefer Existing Core → Protocol → Capability → Skill → Provider → Extension, and only
  then New Core. Don't promote a concept to Core because it's convenient.
- Keep `docs/ECOSYSTEM_CHANGELOG.md` current for anyone (including external tools) watching
  the ecosystem without wanting to track 12 repos' commit histories individually.
- Keep this `docs/ecosystem/` directory current as durable, repository-based memory — update
  it, don't just rely on conversation history, since a new session (or a human) may have
  neither.
