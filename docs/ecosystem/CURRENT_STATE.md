# Current State — the whole ecosystem, as of 2026-09-06

**Status: CURRENT / IMPLEMENTED** (this document itself — a snapshot, re-verified against
real repository state, not carried forward from memory). A fresh session should read this
file first, then `CROSS_REPO_STATUS.md` for per-repo detail, `WORK_QUEUE.md` for what's
next, `DECISION_LOG.md` for why past choices were made, and `HANDOFF.md` for the single-page
summary. This file does not duplicate `docs/REPOSITORY_MAP.md` (the original 11-repo audit)
or `docs/ECOSYSTEM_CHANGELOG.md` (the append-only change log) — it is the current-belief
snapshot those two feed into.

## The one-paragraph version

All ten Skill repositories now publish a `provides` field (Capability ids) in their
machine-readable contracts — the `AI-video-production-OS` Phase 2 rollout, **complete as
of 2026-09-06**. A real,
tested `registry/` library (Phase 1) exists in this repo to consume that field: register
contracts, detect collisions, resolve them by a 3-tier policy. Separately, and **without
using either of those**, `video-production-agent` has independently built and shipped its
own static Skill→Tool selection layer (`SkillRegistry.select_tool`) that already solves the
"which Provider handles this" problem for the nine Skills it integrates, end-to-end, in a
real, tested, working pipeline. These two solutions are not connected, and **as of
2026-09-06's exhaustive investigation (`WORK_QUEUE.md` item 1, `DECISION_LOG.md` D8), that
is the right state for now**: nothing found contradicts `docs/ROADMAP.md` Phase 4's premise
that the Agent's real execution routing (`Service.adapter()` → `ToolRouter`) is still
hardcoded and is what a future registry-driven rewrite would target — the investigation
found two self-declared (contract-unconfirmed) tool ids and two published-but-unconsumed
Capabilities, real but non-urgent findings, not evidence that a connection is needed now.
A small, additive, read-only diagnostic joining the two by Capability id (never tool-id
string) — `WORK_QUEUE.md` item 8 — is now **built**, inside `video-production-agent`
itself (`skills/diagnostics.py`,
[PR #27](https://github.com/kajisho5/video-production-agent/pull/27), kept Draft), and
run against all 10 registered Skills' real data: it confirmed the two self-declared tool
ids and found `CAPABILITY_MISSING` nowhere.

## CURRENT / IMPLEMENTED (real, verified, working code)

- **`dashboard/`** (this repo): a read-only, mobile-first, PWA-ready web dashboard
  showing the ecosystem's real GitHub state — see `dashboard/README.md` and
  `docs/adr/ADR-011-ecosystem-dashboard.md`. A Node/TypeScript aggregator
  (`dashboard/aggregator/`) fetches live GitHub state and combines it with two new
  structured, version-controlled files (`docs/ecosystem/registry.json`,
  `docs/ecosystem/capability-status.json` — structured mirrors of facts already
  recorded in this document set, not a new source of truth) into one normalized
  snapshot; a static React app (`dashboard/web/`) renders it. 61 tests (49 aggregator +
  12 UI), all passing, none requiring network access. **Live**, not just built: GitHub
  Pages was manually enabled 2026-09-06 and `.github/workflows/dashboard.yml` (hourly +
  on-demand) has run successfully against the real network at
  `https://kajisho5.github.io/AI-video-production-OS/`. `MATURITY_MODEL.md` level 6
  ("Distributed") is also now a real live npm/PyPI registry lookup
  (`dashboard/aggregator/src/packageRegistry.ts`), not merely a documented claim. See
  `docs/ecosystem/MATURITY_MODEL.md` for the full ladder.
- **`ffmpeg-skill`**: 21 base-layer tools, real code, real tests, published to npm. The
  ecosystem's execution foundation; every other Skill delegates media processing to it.
  A real cross-OS bug fix landed 2026-09-06 (PR #22): `escape_filter_path`'s single-level
  colon escaping broke every Windows caption/LUT job under FFmpeg 8+ (a filter option
  value is parsed twice; two escape levels are needed), `overlay.py --image` overshot the
  video length by up to 2s on FFmpeg 7+, and macOS CI was installing Homebrew's `ffmpeg`
  formula (no libass/freetype/zimg, hence no subtitles/drawtext/zscale) instead of
  `ffmpeg-full` — all three real, reproduced, fixed, and verified green on Ubuntu/macOS/
  Windows CI on the merged head.
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
  policy, and implements **all 8** of `SKILL_SPEC.md` §8's conformance checks for real
  (3 from a contract document alone; 4 against a live Skill process, verified end-to-end
  against `qc-skill`; 1 — `no_unsafe_shell_out` — via a static AST walk, manually
  verified PASS against all 9 real Python Skills' source trees). The full aspirational
  `CapabilityContract` shape (`docs/SPEC.md` §1) is now also a standalone JSON Schema file
  (`registry/capability_contract.schema.json`, draft 2020-12) — Phase 1 item 1's last
  remaining gap, closed 2026-09-06. 62 tests, all passing, against real captured data, a
  real live `qc-skill` process, synthetic AST-walk fixtures, and the schema itself.
- **`provides` rollout** (this repo, Phase 2): **complete** — all 10 audited Skills'
  `provides` PRs have merged (see `CROSS_REPO_STATUS.md`) — including the ecosystem's one
  real documented Capability collision (`measure.audio.loudness`/`measure.audio.silence`/
  `measure.audio.integrity`, shared by `qc-skill` and `media-analysis-skill`, now
  published under identical ids by both).

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
  (registry-driven discovery) as originally scoped — **confirmed still the right shape**
  by 2026-09-06's exhaustive investigation (`DECISION_LOG.md` D8), not superseded: the
  Agent's real execution routing is still hardcoded (`Service.adapter()` → `ToolRouter`),
  exactly what Phase 4 targets. The concretely-buildable near-term step, a separate,
  additive, read-only diagnostic (`WORK_QUEUE.md` item 8), is now **done** (see CURRENT/
  IMPLEMENTED above) — Phase 3/4 themselves remain PLANNED, genuinely, not merely
  unstarted-by-oversight.
- The `registry/` conformance harness (item 3) is **done**: all 8 of `SKILL_SPEC.md` §8's
  checks are now real functions, including `no_unsafe_shell_out` (a static AST walk,
  manually verified PASS against all 9 real Python Skills' source trees — it does not
  cover `ffmpeg-skill`, a Node.js package). What remains is wiring these checks into an
  actual CI job per Skill, which no repository does yet.
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
- **2026-09-06, exhaustive (all 42 `SkillSpec`s against all 10 Skills' real merged
  `provides[]`):** confirmed only 2 of 10 Skills (`qc-skill`, `subtitle-skill`) have a
  genuine tool-id string mismatch between what the Agent's adapter hardcodes and what the
  Skill's real contract declares (self-declared, not a live bug — see `WORK_QUEUE.md` item
  1); `thumbnail-skill` has the same *package*-id mismatch shape but its tool ids already
  match, proving that mismatch table alone doesn't predict a tool-id drift. The Agent's
  three two-way "candidate" `SkillSpec`s (`media_probe`, `silence_analysis`,
  `loudness_analysis`) are **not** Capability collisions — each candidate maps to a
  genuinely different Capability id, an Agent-internal fallback mechanism unrelated to
  `registry/`'s collision-resolution policy. `video-editing-skill`'s `video.trim` and 5 of
  `audio-production-skill`'s capabilities are published with no consuming `SkillSpec` at
  all yet — real, additive future work, not a defect.

## UNKNOWN

- Whether `video-production-agent`'s static Skill→Tool registration model should ever be
  replaced by dynamic `provides`-based discovery, or whether the static model is in fact the
  right long-term architecture for a system that values "no shortcuts, no plugin manager"
  as strongly as this Agent's own ADRs do. **Partially resolved, not fully**: `DECISION_LOG.md`
  D8 (2026-09-06) concludes the near-term answer is "don't replace it yet, add a read-only
  diagnostic instead" — but whether a full registry-driven Phase 4 rewrite should ever
  actually happen, versus the static model being kept permanently, remains a genuinely
  open architectural question this investigation deliberately did not settle (per
  `WORK_QUEUE.md` item 1's own Boundary).
