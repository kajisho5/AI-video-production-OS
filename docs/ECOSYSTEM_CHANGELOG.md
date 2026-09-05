# Ecosystem Changelog

**Status: CURRENT / IMPLEMENTED** (this document itself; every entry in it records a
real, already-pushed change — nothing here is planned or hypothetical work).

This project spans 11+ separate GitHub repositories (`docs/REPOSITORY_MAP.md`). Anyone
watching the ecosystem's evolution — a human, or an external agent such as ChatGPT — would
otherwise have to separately track each repo's own commit history to see what changed and
why. This file is the single place that happens instead: every externally-visible change
made across the ecosystem *by an agent acting under this project's architecture* (not by
the human maintainer directly, and not routine per-repo maintenance unrelated to this
project) gets one entry here, at the time it is pushed, newest first.

This is a log, not a spec. It records facts (what changed, in which repo, in which PR) and
links to the real diff; it does not restate or duplicate the reasoning that belongs in each
repo's own `docs/decisions.md` ADR, `docs/SPEC.md`, or this project's own `docs/adr/`.

## Format

Each entry:

```
### YYYY-MM-DD — <short title>

- **Repo(s)**: `owner/repo` (+ others if a coordinated cross-repo change)
- **PR(s)**: link(s)
- **What changed**: one or two sentences, factual.
- **Why**: one sentence, pointing at the relevant AI-video-production-OS doc/ADR or the
  originating repo's own ADR, not restating it in full.
- **Status**: draft (open, CI pending/running) / open (CI green, awaiting review) / merged
  / closed (not merged — say why).
```

Status is a snapshot as of the entry's date; it is not updated retroactively when a PR
later merges — check the PR link for current state. A later entry may note a status change
explicitly (e.g. "merged" as its own line) if the merge itself is independently
noteworthy.

---

### 2026-09-05 — `provides` rollout: merge tracker

- **Repo(s)**: all ten Skills in the rollout
- **What changed**: nothing further — this entry only tracks which of the ten `provides`
  PRs have actually merged, updated as each one lands (an exception to this log's usual
  "don't update past entries" rule, made explicitly for this one running tracker so
  merges don't each need their own entry).
- **Merged**: `media-analysis-skill#4` (2026-09-05T20:57Z), `audio-production-skill#3`
  (2026-09-05T20:57Z), `transcription-skill#5` (2026-09-05T20:58Z), `video-editing-skill#2`
  (2026-09-05T20:59Z)
- **Still open**: `subtitle-skill#2`, `thumbnail-skill#2`, `color-grading-skill#4`,
  `motion-graphics-skill#2`, `qc-skill#5`, `ffmpeg-skill#24`
- **Status**: in progress

---

### 2026-09-05 — Resolve media-analysis-skill's remaining 5 Capability ids

- **Repo(s)**: `kajisho5/AI-video-production-OS`, `kajisho5/media-analysis-skill`
- **PR(s)**: `AI-video-production-OS` — pushed directly to PR #1's branch;
  `media-analysis-skill` — additional commit on the still-open
  https://github.com/kajisho5/media-analysis-skill/pull/4
- **What changed**: `docs/CAPABILITY_MATRIX.md` section 8c's bundled, unpinned note
  (`media_probe`, `stream_layout`, `video_format`, `audio_format`, `duration`) is
  resolved into five real, individual Capability ids — `measure.media.probe`,
  `measure.media.stream_layout`, `measure.video.probe`, `measure.audio.probe`,
  `measure.media.duration` — after directly comparing `media-analysis-skill`'s
  analyzer code against `qc-skill`'s rules and `ffmpeg-skill`'s `probe` tool to rule out
  the two collision risks that had blocked the decision. `media-analysis-skill`'s
  `provides` now covers all ten of its analysis kinds (was five). Also corrects an error
  discovered in the process: this Skill has **ten** analysis kinds, not nine as several
  earlier entries in this changelog and in `docs/ROADMAP.md` said — a plain counting
  mistake, now fixed everywhere it appeared.
- **Why**: this was flagged as real, unstarted follow-up work in the Phase 2 rollout and
  in `docs/ROADMAP.md`'s Phase 2 status note — picked up next because it was the most
  concretely-scoped open item directly descended from work already in flight, not a new
  direction.
- **Status**: `AI-video-production-OS` pushed (PR #1, not yet merged);
  `media-analysis-skill` draft (PR #4, CI pending/running as of this entry)

---

### 2026-09-05 — Phase 1: real Capability registry library (`registry/`)

- **Repo(s)**: `kajisho5/AI-video-production-OS` (no other repo involved — pure OS-side
  library work, no Skill repo changes)
- **PR(s)**: none yet — pushed directly to this repo's own open PR branch
  (`claude/ai-video-production-os-arch-fck6fy`, PR #1)
- **What changed**: added `registry/`, a small, dependency-free, tested Python package —
  `docs/ROADMAP.md` Phase 1's schema/registry library, which did not exist as real code
  before this (only a disposable proof-of-concept script and prose in `docs/SPEC.md`).
  It loads a real `CapabilityContract` document, resolves a Skill's identity across the
  three real shapes the ecosystem actually uses, registers `provides` entries, answers
  "who provides Capability X", detects real collisions, and applies
  `docs/CAPABILITY_MODEL.md`'s 3-tier collision policy (`explicit choice > default
  provider > registry refusal`) in code. 21 tests run against real captured `provides`
  data from five Skills, including the ecosystem's one documented Capability collision.
  Also implements 3 of `docs/SKILL_SPEC.md` section 8's 8 conformance checks for real;
  the other 5 (which need a live Skill process) are documented `NotImplementedError`
  stubs, never an unearned pass.
- **Why**: the roadmap's own dependency ordering states nothing later can be honestly
  built without this — Phase 2's Skill retrofit (the `provides` rollout, above) proceeded
  on the strength of the proof-of-concept and `docs/SPEC.md`'s already-validated shape,
  but the actual reusable registry code a future Agent or CLI would import never existed
  until now. This closes that gap with real, tested code rather than only documentation.
- **Status**: pushed (part of the still-open architecture PR #1; not yet merged)

---

### 2026-09-05 — `provides`: publish Capability ids for cross-repository discovery (rollout, part 4 — ffmpeg-skill, rollout complete)

- **Repo(s)**: `kajisho5/ffmpeg-skill`
- **PR(s)**: https://github.com/kajisho5/ffmpeg-skill/pull/24
- **What changed**: adds `provides` to `contract --json`, listing all 21 base-layer tools
  by a cross-repository Capability id (`ffmpeg-skill.cut`, `ffmpeg-skill.loudness`, ...
  one per tool), matching `docs/CAPABILITY_MATRIX.md` section 9. This repo's contract
  shape differs structurally from every other Skill's (`skill: {id, version, ...}` is a
  nested sub-object, not flat top-level fields — `POC_CAPABILITY_CONTRACT.md` Finding 7),
  so `provides` was added at the top level alongside `tools`, not inside `skill`.
- **Why**: `ffmpeg-skill` is the dependency of six other Skills already in this rollout
  (`video-editing-skill`, `subtitle-skill`, `thumbnail-skill`, `audio-production-skill`,
  `color-grading-skill`, `motion-graphics-skill`) and, per `CAPABILITY_MATRIX.md` section
  9, its 21 tools are Capabilities in their own right, independent of those higher-level
  Skills — an Agent may invoke any of them directly. This is the last repo in the
  `provides` rollout: with this PR, all 10 audited Skills now publish the field.
- **Status**: draft (CI pending/running as of this entry)

**Rollout summary (all 10 Skills, 8 PRs, 1 shared architecture change):**
`video-editing-skill`, `subtitle-skill`, `thumbnail-skill`, `audio-production-skill`,
`color-grading-skill`, `motion-graphics-skill`, `qc-skill`, `media-analysis-skill`,
`transcription-skill`, `ffmpeg-skill` — see the four entries above for links and per-repo
detail. Next: monitor these 8 PRs to green/merge, then re-run the `Observe` step of the
autonomous development loop to find the next highest-value gap.

---

### 2026-09-05 — `provides`: publish Capability ids for cross-repository discovery (rollout, part 3 — transcription-skill)

- **Repo(s)**: `kajisho5/transcription-skill`
- **PR(s)**: https://github.com/kajisho5/transcription-skill/pull/5
- **What changed**: adds `provides` to `skill --json`, publishing exactly one Capability id
  — `transcription/transcribe` → `transcribe.audio` — matching `docs/CAPABILITY_MATRIX.md`.
  The other three tools (`segments`, `export`, `check`) operate on an existing Transcript
  rather than producing a new one, so they are not published as a separate Capability
  (same reasoning as `thumbnail-skill`'s `validate` tool).
- **Why**: this repo uses `id` instead of `skill_id` and `TOOLS[].name` instead of
  `tool_id` (the ecosystem's one confirmed naming outlier per `POC_CAPABILITY_CONTRACT.md`
  Finding 5/9); `provides` entries still use the standard `{id, lifecycle, tool_id}` shape
  regardless, so the cross-repo field stays consistent even where a Skill's own internal
  naming differs.
- **Status**: draft (CI pending/running as of this entry)

---

### 2026-09-05 — `provides`: publish Capability ids for cross-repository discovery (rollout, part 2 — the collision pair)

- **Repo(s)**: `kajisho5/qc-skill`, `kajisho5/media-analysis-skill`
- **PR(s)**:
  - https://github.com/kajisho5/qc-skill/pull/5
  - https://github.com/kajisho5/media-analysis-skill/pull/4
- **What changed**: `qc-skill`'s contract gains `provides`, grouping its 35 checks into ten
  Capability ids (`measure.video.freeze`, `measure.video.black_frame`, `measure.video.format`,
  `measure.audio.integrity`, `measure.audio.clipping_and_dynamics`, `measure.audio.channel_layout`,
  `measure.audio.silence`, `measure.audio.loudness`, `measure.subtitle.timing`,
  `measure.delivery.integrity`) — one check (`audio.sample_rate_matches_expected`) is
  intentionally left ungrouped rather than forced into a group it doesn't belong to.
  `media-analysis-skill`'s contract gains `provides` for five of its ten analysis kinds
  (`silence`, `loudness`, `integrity`, `scene_detection`, `timing`) — the other five
  (`media_probe`, `stream_layout`, `video_format`, `audio_format`, `duration`) are
  intentionally left unassigned because `CAPABILITY_MATRIX.md` itself has not settled a
  single id for them yet (guessing here risked publishing a false collision the matrix had
  already ruled out — see each repo's own ADR for the full reasoning). **Update: this gap
  is now closed — see "Resolve media-analysis-skill's remaining 5 Capability ids" above
  for all ten kinds now assigned.**
- **Why**: this is the ecosystem's **one documented Capability collision**, made real. Three
  ids — `measure.audio.loudness`, `measure.audio.silence`, `measure.audio.integrity` — are
  now published *identically* by both Skills, which independently implement the same three
  measurements with no shared code (`docs/CAPABILITY_MODEL.md`'s original motivating
  example). A registry can now see this as one Capability with two Providers instead of two
  unrelated things that happen to share a name — the first real (non-synthetic) validation
  that the collision-resolution model in `CAPABILITY_MODEL.md` actually applies to the real
  ecosystem, not just a designed scenario.
- **Status**: draft (both PRs open; CI pending/running as of this entry)

---

### 2026-09-05 — `provides`: publish Capability ids for cross-repository discovery (rollout, part 1)

- **Repo(s)**: `kajisho5/video-editing-skill`, `kajisho5/subtitle-skill`,
  `kajisho5/thumbnail-skill`, `kajisho5/audio-production-skill`,
  `kajisho5/color-grading-skill`, `kajisho5/motion-graphics-skill`
- **PR(s)**:
  - https://github.com/kajisho5/video-editing-skill/pull/2
  - https://github.com/kajisho5/subtitle-skill/pull/2
  - https://github.com/kajisho5/thumbnail-skill/pull/2
  - https://github.com/kajisho5/audio-production-skill/pull/3
  - https://github.com/kajisho5/color-grading-skill/pull/4
  - https://github.com/kajisho5/motion-graphics-skill/pull/2
- **What changed**: each Skill's machine-readable contract (`contract --json` / `skill
  --json`) gains a new, purely additive top-level `provides` field: a list of
  `{id, lifecycle, tool_id}` (plus a repo-specific disambiguating field — `operation` or
  `element_type` — where one tool covers several operations) naming the cross-repository
  Capability ids that Skill can be asked to perform. No existing field changed meaning; no
  pinned/golden contract fixture broke; each repo's own full test suite + lint/type
  checks were confirmed byte-identical before/after.
- **Why**: this is the first real (non-synthetic) validation of the Capability/Skill
  model this project designed — see `docs/CAPABILITY_MODEL.md` and
  `docs/POC_CAPABILITY_CONTRACT.md` (the proof-of-concept that established the `provides`
  field name and shape against real `contract --json` output from all 10 audited Skills).
  Capability ids match the pre-existing assignments in this repo's own
  `docs/CAPABILITY_MATRIX.md` wherever one existed; where a Skill had no native
  capability-shaped id (audio-production-skill, color-grading-skill,
  motion-graphics-skill), the mapping was a documented naming decision, recorded as a new
  ADR in that repo's own `docs/decisions.md` (ADR-006 video-editing-skill, ADR-10
  audio-production-skill, ADR-15 color-grading-skill, ADR-10 motion-graphics-skill).
- **Status**: draft (all six PRs open; CI pending/running as of this entry — see each
  link for current state)

**Still to come in this rollout** (same pattern, not yet pushed as of this entry):
`qc-skill` + `media-analysis-skill` together (the ecosystem's real Capability-collision
pair — both must publish identical ids for their three overlapping capabilities), then
`transcription-skill`, then `ffmpeg-skill` last (structurally different contract shape,
and the dependency of six other Skills).

---

### 2026-09-05 (earlier) — Architecture Phase 0: 24+ core documents, ADRs, roadmap

- **Repo(s)**: `kajisho5/AI-video-production-OS`
- **PR(s)**: https://github.com/kajisho5/AI-video-production-OS/pull/1
- **What changed**: this repository's initial architecture — `REPOSITORY_MAP.md` (real
  audit of all 11 repos), `CAPABILITY_MODEL.md`, `CORE_PRIMITIVES.md`, `ARCHITECTURE.md`,
  `SPEC.md`, `CAPABILITY_MATRIX.md`, `ROADMAP.md`, `GOVERNANCE.md`, `SECURITY_MODEL.md`,
  and the rest of the documents listed in this directory, plus `docs/adr/ADR-001`
  through `ADR-010` and the project README.
- **Why**: the founding request for this project — audit the real ecosystem before
  designing anything, and produce a rigorous, evidence-based Capability/Skill/
  Provider/Runtime architecture that never invents functionality the ecosystem does not
  actually have.
- **Status**: open (see PR for current CI/review state)

---

*Earlier ecosystem history (each repo's own implementation, before this project existed)
is not backfilled here — see each repo's own `docs/decisions.md` / README for that. This
log starts from the point an agent acting under this project began making cross-repo
changes.*
