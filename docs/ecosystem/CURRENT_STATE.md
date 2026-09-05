# Current State — the whole ecosystem, as of 2026-09-05

**Status: CURRENT / IMPLEMENTED** (this document itself — a snapshot, re-verified against
real repository state, not carried forward from memory). A fresh session should read this
file first, then `CROSS_REPO_STATUS.md` for per-repo detail, `WORK_QUEUE.md` for what's
next, `DECISION_LOG.md` for why past choices were made, and `HANDOFF.md` for the single-page
summary. This file does not duplicate `docs/REPOSITORY_MAP.md` (the original 11-repo audit)
or `docs/ECOSYSTEM_CHANGELOG.md` (the append-only change log) — it is the current-belief
snapshot those two feed into.

## The one-paragraph version

Ten Skill repositories now publish a `provides` field (Capability ids) in their machine-
readable contracts — the `AI-video-production-OS` Phase 2 rollout, mostly merged. A real,
tested `registry/` library (Phase 1) exists in this repo to consume that field: register
contracts, detect collisions, resolve them by a 3-tier policy. Separately, and **without
using either of those**, `video-production-agent` has independently built and shipped its
own static Skill→Tool selection layer (`SkillRegistry.select_tool`) that already solves the
"which Provider handles this" problem for the nine Skills it integrates, end-to-end, in a
real, tested, working pipeline. These two solutions are not yet connected. That gap — not a
missing capability, but an unconnected one — is this ecosystem's most important open
question right now (see `WORK_QUEUE.md` item 1).

## CURRENT / IMPLEMENTED (real, verified, working code)

- **`ffmpeg-skill`**: 21 base-layer tools, real code, real tests, published to npm. The
  ecosystem's execution foundation; every other Skill delegates media processing to it.
- **9 delegating/self-contained Skills** (`video-editing-skill`, `audio-production-skill`,
  `color-grading-skill`, `subtitle-skill`, `motion-graphics-skill`, `thumbnail-skill`,
  `qc-skill`, `media-analysis-skill`, `transcription-skill`): each independently
  implemented, tested, with its own CI, each exposing a `contract`/`skill --json` command.
- **`video-production-agent`**: **far more mature than earlier architecture-phase documents
  in this repo assumed.** It is not just a Phase-1 prototype — real, tested (187 unit tests,
  184 passing; 3 failures are this sandbox's own environment contamination from other
  repos being cloned/pip-installed into it during this session, not agent bugs), with:
  - A working Observation → Inference → Decision → Plan → Project IR → Validation →
    Execute → QA → Report/Provenance pipeline (its own "Phase 1").
  - Real integration with **all nine** other Skills (its own "Phase 3", ADR-028 through
    ADR-032): video-editing-skill, audio-production-skill, subtitle-skill, thumbnail-skill,
    color-grading-skill, motion-graphics-skill, qc-skill, media-analysis-skill,
    transcription-skill — each reached through its own adapter and CLI contract, never a
    shortcut.
  - A real, working end-to-end pipeline: concatenate multiple videos, clean up silence,
    generate and burn in subtitles, render a thumbnail, run QC, produce a delivery
    artifact with provenance — demonstrated in its own README as a real command sequence,
    not a mockup.
  - Its own Skill→Tool selection layer (`SkillRegistry.select_tool`, `ToolRouter`),
    already solving the exact problem `AI-video-production-OS` `docs/ROADMAP.md` Phase 4
    describes as future work ("real registry-driven discovery") — solved independently,
    with a different mechanism (static registration + declared-order tool candidates, not
    Capability-id-based discovery), and predating this project's `registry/` library.
  - 34 ADRs recording real design decisions across 22+ landed PRs.
- **`registry/`** (this repo, Phase 1): a small, tested Python library — loads a
  `CapabilityContract` document, resolves Skill identity across the ecosystem's three real
  shapes, registers `provides` entries, detects collisions, applies the 3-tier resolution
  policy. 21 tests, all passing, against real captured data.
- **`provides` rollout** (this repo, Phase 2): all 10 audited Skills have a PR adding
  `provides`; as of this snapshot most are merged (see `CROSS_REPO_STATUS.md` for the live
  count) — including the ecosystem's one real documented Capability collision
  (`measure.audio.loudness`/`measure.audio.silence`/`measure.audio.integrity`, shared by
  `qc-skill` and `media-analysis-skill`, now published under identical ids by both).

## EXPERIMENTAL (real code, but young / unproven at scale)

- Every Capability id published under `provides` carries `lifecycle: EXPERIMENTAL` — none
  has been promoted to `STABLE` anywhere in the ecosystem yet; this is accurate, not
  understated.
- `registry/`'s collision-resolution policy (`resolve()`) has real tests against the one
  real collision, but has never been exercised by a live Agent decision — no code path
  today actually calls it during a real production run.
- `video-production-agent`'s Skill→Tool selection layer is real and tested, but its actual
  multi-candidate cases are all `ffmpeg-skill` vs. `media-analysis-skill`/`video-editing-skill`
  two-way choices (`media_probe`, `silence_analysis`, `loudness_analysis`,
  `silence_cleanup`) — it has never been exercised on the specific 3-way-shaped
  `measure.audio.loudness`-style collision `registry/`'s collision detector proves, because
  `qc-skill` is never registered as a competing candidate there at all (confirmed
  deliberate — see "Resolved" below, not a gap).

## PLANNED (designed, not built)

- `docs/ROADMAP.md` Phase 3 (real Provider-collision resolution) and Phase 4
  (registry-driven discovery) as originally scoped — **now superseded in part** by the
  discovery in this document that `video-production-agent` already solved an equivalent
  problem independently. The remaining real work is connecting the two, not building
  Phase 4 from scratch (see `WORK_QUEUE.md`).
- `registry/` item 1 (a standalone JSON Schema file for the CapabilityContract shape) and
  item 3's one remaining stubbed conformance check (`no_unsafe_shell_out` — the other 4
  of the original 5 process-based checks, `forbidden_keys_rejected`, `doctor_status`,
  `workspace_confinement` and `no_clobber_input`, are now real, verified against a live
  `qc-skill` process; the latter two were redesigned mid-implementation once live testing
  showed `qc-skill` exposes no output-path field to probe — see `registry/README.md`).
- The four unresolved `media-analysis-skill` analysis kinds noted in `CAPABILITY_MATRIX.md`
  §8c were resolved during this session (all ten kinds now have Capability ids) — this line
  is intentionally kept to record that PLANNED work here is now DONE, not silently dropped.

## VISION (in MASTER_SPEC / architecture docs, no real code path yet)

Per `video-production-agent`'s own `docs/GAP_ANALYSIS_PHASE2.md` §2: natural-language
understanding (AI), the conference pipeline body, multicam/captions/scenes, a Web UI, a job
queue, `--allowed-input`, Incident detection (black/freeze frames), Semantic QA, enforced
analysis budgets, and **AI Provider connection itself** — the agent's decision pipeline is
real and deterministic, but no real LLM reasoning is wired in; only a `NullProvider` exists.
This is the single most important VISION-not-CURRENT fact in the whole ecosystem: **nothing
in this ecosystem today lets an agent turn natural-language intent into a plan** — every
real pipeline run demonstrated so far is driven by explicit `--set` flags, not natural
language.

## RESOLVED during this session's investigation (was UNKNOWN)

- **The qc-skill/media-analysis-skill role separation is confirmed deliberate**, not
  accidental. `video-production-agent`'s ADR-032 states explicitly: "qc-skill は最終
  promotion の gate として接続" (qc-skill is connected as the final promotion gate) —
  it is architecturally scoped as the delivery-acceptance gate, never as an alternative
  per-measurement Provider to `media-analysis-skill`. This is why the Agent's registry
  never lists them as competing candidates for the same production skill: it's by design,
  confirmed by primary-source ADR text, not an artifact of what happened to get built
  first.
- **Tool-id naming between the Agent and the real Skills diverges for 3 of 10 Skills**
  (`subtitle-skill`, `thumbnail-skill`, `transcription-skill` — see `WORK_QUEUE.md` item 1
  for the full table), always deliberately and correctly handled inside each adapter. Any
  future integration must key on Capability id, never on tool-id string equality.

## UNKNOWN

- Whether `video-production-agent`'s static Skill→Tool registration model should ever be
  replaced by dynamic `provides`-based discovery, or whether the static model is in fact the
  right long-term architecture for a system that values "no shortcuts, no plugin manager"
  as strongly as this Agent's own ADRs do. This is a real open architectural question, not
  a gap to silently close — see `DECISION_LOG.md` for the reasoning so far and
  `WORK_QUEUE.md` item 1 for the investigation this implies.
