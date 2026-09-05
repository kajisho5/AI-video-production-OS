# AI Video Production OS

An open-source **operating system for AI-assisted video production**: a set of open
contracts and shared execution infrastructure that let independent Skills, Providers,
and Agents — human or AI — turn video-production intent into deterministic, verifiable,
reproducible changes to a project's artifacts.

> **This repository is currently a research and architecture deliverable, not a
> runnable system.** It defines the contracts and design decisions the ecosystem below
> is converging toward. See [Status](#status) before assuming anything here is already
> built.

## Why this exists

An ecosystem of real, independently-built repositories already does meaningful video
production work: [`video-production-agent`](https://github.com/kajisho5/video-production-agent)
plans and orchestrates; [`ffmpeg-skill`](https://github.com/kajisho5/ffmpeg-skill) and
eight other Skill repos execute typed, deterministic media operations. This project
does **not** rewrite them. It audited them (see
[`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md)) and defines the contracts that let
that ecosystem — and Skills, Providers, and Agents nobody has built yet — interoperate
without depending on each other's internals.

Two things this project explicitly refuses to be, because the evidence argues against
them (see [`docs/NEGATIVE_ARCHITECTURE.md`](docs/NEGATIVE_ARCHITECTURE.md)):

- **Not an AI that makes video.** No component here is an autonomous video-making
  agent. An Agent reasons and proposes; Skills execute typed operations
  deterministically; a human or explicit approval gate sits between the two wherever an
  action is hard to reverse.
- **Not a wrapper around FFmpeg, an LLM, or one Agent framework.** FFmpeg, MCP, and
  `video-production-agent` are each one implementation choice the architecture is
  designed to outlive, not the architecture itself.

## What it is

A **Capability/Skill/Provider/Runtime** contract layer plus an **Artifact/Plan/
Execution/Provenance/Verification** kernel that sits between:

- an **Agent** — intent interpretation, reasoning, planning, decision-making,
  orchestration; vendor- and framework-independent by design; and
- an **ecosystem of Skills** — versioned packages that each execute one domain's typed
  operations deterministically, and never emit a raw shell command or unvalidated
  filter string to do it.

```
Human / AI
    ↓
Production Intent  (Goals, Constraints, Preferences, Policy, Permissions)
    ↓
Agent  (Observation → Inference → Decision, evidence required)
    ↓
ProductionPlan  (a DAG of typed Operations over Artifacts)
    ↓
Capability Discovery  (Skill / Provider registry)
    ↓
Runtime  (subprocess isolation, path policy, no shell, no raw filters)
    ↓
Artifact  (content-addressed identity, provenance)
    ↓
QC / Verification  (PASS / WARN / FAIL / UNKNOWN — measures, never decides)
    ↓
Production Receipt
```

Full definitions: [`docs/CORE_PRIMITIVES.md`](docs/CORE_PRIMITIVES.md) ·
[`docs/CAPABILITY_MODEL.md`](docs/CAPABILITY_MODEL.md) ·
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

| | |
|---|---|
| **CURRENT** | The 11-repository audit ([`REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md)), the full architecture and contract design (~50 documents below), 10 ADRs. |
| **PLANNED** | A reference Capability Contract validator/registry, the retrofit of existing Skills to publish it, a conformance test suite for third-party Skills. See [`ROADMAP.md`](docs/ROADMAP.md). |
| **EXPERIMENTAL / UNVERIFIED** | Whether a second Agent, a second media-engine Provider, or a real third-party Skill can actually be built against these contracts — architecturally designed for, never yet exercised. See [`FINAL_REVIEW.md`](docs/FINAL_REVIEW.md) §3–4 for the honest accounting. |

This distinction is load-bearing, not a formality: every document below tags every
claim CURRENT / FUTURE / EXPERIMENTAL / UNKNOWN, and none of them presents planned
architecture as already-working functionality.

## The ecosystem today

Ten independent Skill repositories, plus one orchestrating Agent, all audited directly
(source, tests, CI, security, versioning — not just READMEs):

| Repo | Role | Depends on |
|---|---|---|
| [`ffmpeg-skill`](https://github.com/kajisho5/ffmpeg-skill) | Typed FFmpeg execution — the shared media-execution substrate | — |
| [`video-editing-skill`](https://github.com/kajisho5/video-editing-skill) | Trim / cut / concat / resize | ffmpeg-skill |
| [`audio-production-skill`](https://github.com/kajisho5/audio-production-skill) | Gain / mix / normalize / dynamics | ffmpeg-skill |
| [`color-grading-skill`](https://github.com/kajisho5/color-grading-skill) | HDR→SDR / LUT / color tagging | ffmpeg-skill |
| [`subtitle-skill`](https://github.com/kajisho5/subtitle-skill) | Subtitle generation + burn-in | ffmpeg-skill (burn-in only) |
| [`motion-graphics-skill`](https://github.com/kajisho5/motion-graphics-skill) | Title cards / lower-thirds / overlays | ffmpeg-skill |
| [`thumbnail-skill`](https://github.com/kajisho5/thumbnail-skill) | Raster thumbnail composition | ffmpeg-skill (frame extraction only) |
| [`qc-skill`](https://github.com/kajisho5/qc-skill) | Deterministic QC: PASS/WARN/FAIL/UNKNOWN, never decides | ffmpeg/ffprobe directly |
| [`media-analysis-skill`](https://github.com/kajisho5/media-analysis-skill) | Deterministic observation, never mutates | ffmpeg/ffprobe directly |
| [`transcription-skill`](https://github.com/kajisho5/transcription-skill) | Local ASR (faster-whisper) | — |
| [`video-production-agent`](https://github.com/kajisho5/video-production-agent) | Orchestrator: Observation→Inference→Decision→Plan→IR→Execution. **Usable but incomplete — the first consumer of this OS, not the OS itself.** | all of the above |

`transcription-skill` exists, works, and was not part of this project's original
"9 Skills" framing — direct proof the Skill count was never fixed and the OS must not
assume it is. Full detail, including two confirmed real gaps (a naming collision
between "Skill" meanings in `video-production-agent`'s own source, and duplicated
loudness/silence measurement logic between `qc-skill` and `media-analysis-skill`), is
in [`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md).

## How Skills work, and how to add one

A **Skill** is a versioned package implementing one or more named **Capabilities**
(e.g. `edit.trim`, `measure.audio.loudness`); a **Provider** is one concrete
implementation of a Capability; the **Runtime** is the shared safety contract (no
shell, no raw filter strings, path-confined, timeout-bounded) every Skill already
independently converged on. See [`docs/CAPABILITY_MODEL.md`](docs/CAPABILITY_MODEL.md).

To propose a new Skill: [`docs/SKILL_PROPOSAL.md`](docs/SKILL_PROPOSAL.md) has a
4-step decision procedure that, in order, checks whether your idea is really a new
parameter on an existing Capability, a new Capability inside an existing Skill, a new
Provider of an existing Capability — before ever concluding it needs a new repository.
This exists specifically to prevent Skill-repository sprawl.
[`docs/SKILL_SPEC.md`](docs/SKILL_SPEC.md) defines what a conformant Skill must do
regardless of implementation language. If your proposal requires creating a new
repository, publishing a package, or any other hard-to-reverse action, it must be
reported using the format in
[`docs/IMPLEMENTATION_PROTOCOL.md`](docs/IMPLEMENTATION_PROTOCOL.md) — never taken
silently.

## How the Agent interacts with the OS

The Agent is a role, not a fixed piece of software. `video-production-agent` plays it
today, but the OS owns the *shape* of Observation, Inference, Decision, ProductionPlan,
and Artifact — a contract any Agent (a different AI, a deterministic rules engine, or a
human at a CLI) can drive — while the Agent owns the *logic* that produces a Decision
from an Observation. The OS never depends on a specific AI vendor: `video-production-agent`'s
own deterministic pipeline (silence trim, loudness normalize) already runs today with
zero LLM involvement. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §3 and
[`docs/AGENT_EVOLUTION.md`](docs/AGENT_EVOLUTION.md).

## How QC and provenance work

QC (`qc-skill`) measures and returns `PASS | WARN | FAIL | UNKNOWN` — it never decides
what to do about a failure; that's an Agent Decision citing the QC finding as evidence.
See [`docs/QC_ARCHITECTURE.md`](docs/QC_ARCHITECTURE.md). Every Artifact carries
content-addressed identity and a provenance chain back through its producing Operation,
Skill, and Provider versions — generalized directly from `qc-skill`'s existing, already-
correct `sha256(canonical_json(...))` design. See
[`docs/PROVENANCE.md`](docs/PROVENANCE.md).

## Roadmap

Phase 0 (this research) is substantially complete. Phase 1 (a reference Capability
Contract format + registry library) is the next concrete step; it requires zero changes
to any existing Skill or Agent. Full phased plan, real dependencies between phases, and
what does/doesn't change for `video-production-agent` at each step:
[`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/MIGRATION_STRATEGY.md`](docs/MIGRATION_STRATEGY.md).

## Documentation index

The full architecture is ~50 documents. Start here, in order:
[`REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md) (evidence) →
[`CORE_PRIMITIVES.md`](docs/CORE_PRIMITIVES.md) →
[`CAPABILITY_MODEL.md`](docs/CAPABILITY_MODEL.md) →
[`ARCHITECTURE.md`](docs/ARCHITECTURE.md) →
[`SPEC.md`](docs/SPEC.md) →
[`FINAL_REVIEW.md`](docs/FINAL_REVIEW.md) (the honest accounting of what's verified vs.
assumed). Every other document in [`docs/`](docs/) and every [ADR](docs/adr/) builds on
these five. [`GLOSSARY.md`](docs/GLOSSARY.md) defines every term used once.
[`ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md) is a scannable ADOPT /
DEFER / REJECT table if you want the conclusions without the reasoning.

## Contributing

Single-maintainer, pre-1.0, lightweight ADR-based decision process — see
[`docs/GOVERNANCE.md`](docs/GOVERNANCE.md). This is not a finished product looking for
users; it's a foundation looking for the second Skill, the second Agent, or the second
media engine that would actually prove the independence claims above.

## License

See individual repositories; this repository's own license is TBD (UNKNOWN — not yet
set at time of writing).
