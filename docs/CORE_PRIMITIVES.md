# Core Primitives

This document defines the fundamental concepts of the AI Video Production OS. Every
primitive below is justified by a concrete need found in `REPOSITORY_MAP.md`'s evidence,
not introduced because it sounds sophisticated. Where a primitive already exists in
`video-production-agent`'s code, that is stated, and this document either **adopts it
as-is**, **adopts it with a renamed/clarified boundary**, or **proposes a change** — it
never silently assumes the existing shape is correct.

Status tags used throughout: **CURRENT** (exists in `video-production-agent` or a Skill
today), **FUTURE** (proposed, not implemented anywhere yet), **RENAME** (exists, but this
doc changes its name or scope to remove an ambiguity found in the audit).

## 0. What "OS" means here

An **operating system for a domain** is a set of contracts and shared infrastructure that
let independently-built programs cooperate safely without depending on each other's
internals. That is the sense used here — not a kernel, not a daemon, not a service you
deploy. Concretely, the AI Video Production OS is:

- A **set of typed contracts** (schemas) that a Skill must speak to be usable by any
  Agent, and that an Agent must speak to be usable with any Skill.
- A **capability registry and discovery mechanism** so "what can this system do right
  now" is a queryable fact, not a hardcoded list.
- A **shared execution boundary** (safe subprocess invocation, path policy, resource
  limits) so every Skill does not reinvent the same security code — which, per
  `REPOSITORY_MAP.md` finding 3, is exactly what happened.
- An **artifact, provenance, and verification model** so any output can be traced back to
  the inputs, operations, and Skill versions that produced it.
- Explicitly **not**: an AI framework, a specific model integration, a specific media
  engine, a UI, a job scheduler/queue, or a network service. Those are things that plug
  into the OS or consume it.

The test for whether something belongs in the OS: **would a second, independently-built
Agent and a third-party Skill both need this to exist, in the same shape, to
interoperate?** If yes, OS. If it's one particular way of doing something well within
that contract, it's a Skill, a Provider, or the Agent's own logic.

## 1. Capability

**FUTURE as a formal registry entity; CURRENT as an informal concept** (`SkillRegistry`'s
abstract skill names like `silence_cleanup`, `capabilities.resolver`'s AVAILABLE/MISSING
states, `ffmpeg-skill`'s `capabilities.required/available`).

A **Capability** is a named, typed, versioned unit of "something the system can
accomplish" — independent of which Skill implements it. Example IDs (dotted,
namespaced, mirroring how `ffmpeg-skill`'s tool ids are already namespaced
`ffmpeg-skill/cut`): `edit.trim`, `edit.concat`, `audio.normalize.loudness`,
`color.hdr-to-sdr`, `measure.audio.loudness`, `measure.video.freeze`,
`subtitle.generate`, `subtitle.burn-in`, `transcribe.audio`.

A Capability declares:
- **id** — stable, namespaced string.
- **input/output artifact types** it operates on (see §7).
- **parameter schema** — the typed, closed vocabulary of arguments (this is what every
  Skill in the audit already does per-operation; a Capability generalizes it across
  Skills).
- **verification hint** — which QC checks, if any, are the natural way to verify this
  Capability's output (mirrors `ffmpeg-skill`'s existing `verification.tools` field).
- **lifecycle state** (see `SKILL_SPEC.md`).

A Capability is **not** an implementation. It is the thing a `ProductionPlan` refers to.
This is the direct fix for `REPOSITORY_MAP.md` finding 2 (duplicated loudness/silence/
integrity measurement): today `qc-skill` and `media-analysis-skill` each implement
"loudness measurement" with no shared identity between them. Under this model, both
register as **Providers** of the same Capability id (`measure.audio.loudness`), and the
collision becomes a visible, resolvable registry fact instead of silent duplication.

## 2. Skill

**CURRENT**, but this document tightens the definition to resolve a real naming
collision found in the audit: `video-production-agent`'s own source uses "Skill" for two
different things — an external package (`SkillPackage`, e.g. the `ffmpeg-skill` repo) and
an internal capability name (`SkillSpec`, e.g. `silence_cleanup`). This document keeps
"Skill" for the first meaning only, and calls the second meaning what it actually is: a
**Capability**.

A **Skill** is a versioned, independently deployable package that implements one or more
Capabilities and exposes them through the OS's Skill Contract (see `SKILL_SPEC.md`). A
Skill:
- Owns a coherent domain (editing, audio, color, subtitles, QC, ...).
- Declares the Capabilities it provides, their parameter schemas, and its own
  dependencies (e.g. every current Skill except `ffmpeg-skill`, `qc-skill`, and
  `media-analysis-skill` declares a dependency on `ffmpeg-skill` at a version range).
- Owns its own security boundary (subprocess execution, path policy) — today
  reimplemented per-Skill; this OS pulls the *pattern* into a shared reference
  implementation (see `SECURITY_MODEL.md`) without requiring a Skill to use it, so a
  third-party Skill in another language can still conform to the contract.
- Has its own release version, independent of the OS and of any other Skill.

The 10 existing Skill repos are the **current generation**, not the definition of what a
Skill is. `transcription-skill` — real, working, and not in the task's original list of
9 — is itself the proof: the OS must not hardcode a skill count anywhere.

## 3. Provider

**FUTURE** (does not exist as a formal concept anywhere in the ecosystem today — its
absence is precisely why `qc-skill` and `media-analysis-skill` duplicated measurement
logic instead of one declaring itself an alternate provider of the other's capability).

A **Provider** is one concrete implementation of a Capability, registered under that
Capability's id. A Skill can be a Provider of many Capabilities; a Capability can have
many Providers. Examples once formalized: `measure.audio.loudness` would have two
Providers (`qc-skill`, `media-analysis-skill`); `transcribe.audio` has one today
(`transcription-skill`'s `faster-whisper` engine) but is explicitly designed in that
repo's own registry (`engines/registry.py`) to add more without redesign — the OS
Provider concept is exactly that pattern lifted one level up, from "engines within a
Skill" to "Skills as providers of an OS Capability."

Provider selection is a **Plan-time or Agent-time decision**, never a silent runtime
default. The OS registry surfaces all Providers of a requested Capability; something
downstream (the Agent, a pipeline profile, or an explicit OS default-provider policy
file, analogous to `ffmpeg-skill`'s `doctor` capability-detection report) must pick one,
and that pick is recorded in provenance.

## 4. Runtime

**CURRENT as a per-Skill pattern, FUTURE as a shared OS contract.** Every Skill except
the three that talk to `ffmpeg`/`ffprobe` directly (`ffmpeg-skill`, `qc-skill`,
`media-analysis-skill`) implements an identical adapter shape: locate a dependency
Skill's checkout, version-check its contract, invoke it as
`[python, <skill>/scripts/<tool>.py, <typed argv>, --json]` via a list-argv subprocess
with a scrubbed environment, its own process group, and a path policy. This convergent,
independently-arrived-at design **is** the Runtime primitive — it is not proposed from
scratch here, it is extracted from what five different Skill authors already built the
same way.

The **Runtime** is the OS-defined contract for how any Capability invocation actually
executes: process isolation, timeout and kill-tree semantics, environment scrubbing,
path containment, and the canonical `FORBIDDEN_KEYS` denylist (today reimplemented,
slightly differently, in at least seven repos). The OS ships this as a **reference
library** (so Python Skills don't reimplement it) and, for Skills in other languages, as
a **conformance test suite** any Skill must pass regardless of implementation language
(see `SKILL_SPEC.md` §Conformance). The Runtime does not replace `ffmpeg-skill`'s own
execution of ffmpeg/ffprobe binaries — it is the layer *between* a Capability invocation
and whatever process a Skill decides to run.

## 5. Observation, Inference, Decision

**CURRENT, adopted as-is.** These three types already exist in `video-production-agent`
(`models/__init__.py`, `agent/inference.py`, `agent/decision.py`) with exactly the
separation of responsibility this project's task brief asks for, and they are kept
unchanged at the OS-contract level:

- **Observation** — evidence measured by a tool, `provenance="OBSERVED"`, never
  overwritten by inference. ("There is a freeze from 00:31–00:34, 3.2s of near-identical
  frames" — this is qc-skill's/media-analysis-skill's job.)
- **Inference** — an interpretation of one or more Observations, must cite the evidence
  it is based on. ("This freeze is unwanted.")
- **Decision** — `subject`, `type` (KEEP/REMOVE/TRANSFORM/DELIVER/SKIP/REVIEW/BLOCK),
  `risk`, `approval` (AUTO/CONFIRM/BLOCK), `basis` (policy/preference/constraint
  provenance), mandatory `evidence`. Risk and approval are set independently from
  confidence — a design principle already enforced in `decision_engine.py` that this
  document treats as correct and keeps.

**Why this survives red-teaming intact:** it is the one part of the existing ecosystem
that already satisfies Rule 12 (don't let QC silently decide) and Rule 14 (don't let AI
reasoning silently become execution) by construction — a Decision is a distinct,
typed, evidenced object, never an implicit side effect of a measurement or a raw model
completion. The OS's job is to keep owning the *type* (so any Agent produces the same
shape of Decision) while the Agent owns the *logic* that produces one.

## 6. ProductionPlan and Operation

**CURRENT, adopted with one clarification.** A `ProductionPlan` is a DAG of
`ProductionStep`s derived from approved Decisions; `plan_status`/`step_status` are always
computed from decision states, never set by hand (a good invariant, kept). The plan
compiles into `Operation`s — "one deterministic tool invocation," with typed args, never
raw argv/shell (`execution/compiler.py`).

**Clarification this document adds:** composability (§9 of the task brief) is answered
by treating the Plan as a **DAG over Artifacts and Operations**, not a fixed linear
pipeline. This is not a new engine — `video-production-agent`'s plan/step model is
already graph-shaped internally — it is a naming/documentation clarification so that
future work doesn't accidentally special-case linear "editing → audio → color → ..."
pipelines instead of general dependency graphs. A pipeline (the fixed sequence the task
brief lists in several places) is one specific DAG shape among many the same
representation can express, exactly like Dagster's asset graph subsumes Airflow's linear
DAG-of-tasks (see `COMPETITIVE_ANALYSIS.md`).

## 7. Artifact

**CURRENT, adopted, generalized.** `video-production-agent`'s `Artifact` dataclass
(`hash`, `logical_name`, `plan_id/plan_version`, `job_id`, `stage`
working→candidate→approved→final→archive, `provenance`) already has the right shape.
This document generalizes it as the OS-wide Artifact contract, with types drawn directly
from what the ecosystem actually produces today (not invented): video, audio, image,
subtitle document, project/IR document, QC report, analysis result, thumbnail, receipt.
Every Artifact has: identity (content hash — never path or mtime, per `qc-skill`'s
already-correct pattern), type, producing Operation, producing Skill+version,
parent/derived-from links, and timestamps. See `ARTIFACT_MODEL.md`.

## 8. Timeline

**RENAME — real, present naming collision found in the audit, not a hypothetical one.**
`video-production-agent` already has a module called `temporal/timeline.py`, but it
models **event history over wall-clock/media time** (which event kinds are "active" in a
time range — a session/observability concept), not an **edit timeline** (clips, tracks,
transitions, captions, markers — an OpenTimelineIO-style domain model of an edited
sequence). No edit-timeline primitive exists anywhere in the ecosystem today; the
Project IR's `timeline` section in `schemas/project.schema.json` is the closest thing,
but it has not been audited in enough depth to know how close.

This document treats these as **two distinct primitives that must not share a name**:
the existing one stays `Event Timeline` / `temporal` (unchanged, out of this document's
scope), and the new one — an edit timeline — is proposed as `Timeline` going forward,
modeled after OpenTimelineIO's clip/track/transition/marker shape (validated prior art,
see `COMPETITIVE_ANALYSIS.md`) rather than invented from scratch. It is FUTURE work
(Roadmap Phase 3+), not implemented today. See `TIMELINE_MODEL.md`.

## 9. QCReport, QCFinding, QCCheck, QCMeasurement

**CURRENT, adopted as-is from `qc-skill`.** `QCMeasurement` (a number/fact) →
`QCFinding` (measurement + threshold judgment) → `QCCheck` (named group of findings) →
`QCReport` (`PASS|WARN|FAIL|UNKNOWN`, worst-wins aggregation, never defaults to PASS on
empty input). This hierarchy is kept unchanged; see `QC_ARCHITECTURE.md` for how it
generalizes to verifying a `ProductionPlan`, not just a final file.

## 10. ProductionReceipt

**FUTURE — does not exist as a discrete artifact anywhere today**, but is directly
buildable from two things that already exist and already agree with each other:
`qc-skill`'s content-addressed `identity` scheme, and `video-production-agent`'s
`ProjectIR.provenance` dict (`source_hashes, profile_version, skill_versions,
tool_versions, ai_calls, recovery, runs, plan_hash, ir_hash`). A ProductionReceipt is the
final, emitted-once Artifact that answers "what happened, why, with what tools, did it
pass verification" for one completed Plan. See `PROVENANCE.md`.

## 11. Resource, Workspace, Project, Job, Pipeline

- **Workspace** — **CURRENT**, already the unit of filesystem confinement in every
  Skill's `PathPolicy`. Kept as-is: a directory boundary outputs must live inside and
  inputs are resolved against.
- **Project** — **CURRENT** (`ProjectIR`'s `project` section) — the unit of identity for
  one production (one video being made), distinct from a Workspace (filesystem) and a
  Plan (one approved course of action for that project; a Project can accumulate
  multiple Plans over revisions, per `revision.md`/ADR-034 in `video-production-agent`).
- **Job** — **CURRENT** (`video_agent.jobs.job`) — one execution run of a Plan; supports
  resume (`render --resume last|JOB_ID`) via `Operation.idempotency_key`.
- **Pipeline** — not a separate primitive; per §6, a pipeline is a named, reusable shape
  of Plan (a template), not a new kernel concept. `video-production-agent`'s `profiles/`
  directory (`generic`, `youtube`, `conference`) is exactly this today.
- **Resource** — **FUTURE, minimal.** No CPU/GPU/concurrency scheduling exists anywhere
  in the ecosystem today (confirmed absent in every audit). This document does not invent
  a scheduler; see `EXECUTION_MODEL.md` for the deliberately small resource model this OS
  actually needs at this stage.

## 12. Agent

**Not an OS primitive — a role, played by software the OS does not own.** Per the
explicit architectural clarification for this project: `video-production-agent` is
**a** Agent — today's most complete one — not **the** Agent, and not the OS. An Agent
interprets intent, reasons, proposes/approves Decisions and Plans, and orchestrates
Capability invocations through the OS contracts. See `ARCHITECTURE.md` §OS/Agent
Boundary for the full argument and the concrete test this document applies to every
primitive above: *would this still make sense if `video-production-agent` were replaced
by a different Agent, or by a human using a CLI directly?* Every primitive in this
document passes that test as written; where the current code does not yet (e.g.
Observation/Inference/Decision types living inside `video_agent`'s own source tree
instead of a shared contract package), that is named as Roadmap work, not treated as
already solved.
