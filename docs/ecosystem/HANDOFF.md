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
this project's `provides`/`registry/` system. The two are not connected yet. Don't assume
Phase 4 is "still to build from scratch" — read `CURRENT_STATE.md` and `WORK_QUEUE.md` item
1 before planning any registry/discovery work.

## What's actively in flight right now

- The Phase 2 `provides` rollout: 10 PRs, one per Skill, most merged (live count in
  `docs/ECOSYSTEM_CHANGELOG.md`'s merge tracker). Standing PR-maintenance rules apply:
  drive each to green, respond to review comments, don't stop watching until merged/closed.
- No PR is open against `video-production-agent` from this project. None is planned until
  `WORK_QUEUE.md` item 1's investigation concludes something concrete and additive.

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
