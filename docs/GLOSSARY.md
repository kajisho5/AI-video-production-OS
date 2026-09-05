# Glossary

Status: **CURRENT, draft, 2026-09-05.** Every definition below is written to match the
term as it is actually defined in `CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`, `SPEC.md`,
`ARCHITECTURE.md`, or `REPOSITORY_MAP.md` — this document does not introduce new meanings
for existing terms, it consolidates them for reference. Where a term's status (CURRENT /
FUTURE / EXPERIMENTAL / RENAME) differs across contexts, that is noted; see those source
documents for full justification and worked examples.

## How to read this doc

Entries are alphabetical. Each entry gives a precise one-to-three sentence definition and
a pointer to the source document that defines it authoritatively — this glossary is a
convenience index, not a replacement for reading those documents. A `→` cross-reference
points to a related term in this same glossary.

---

**Agent** — Not an OS primitive; a role played by software (or a human) that interprets
intent, reasons, proposes and approves → Decisions and → ProductionPlans, and orchestrates
→ Capability invocations through the OS's contracts. `video-production-agent` is **a**n
Agent — today's most complete one — not **the** Agent and not the OS itself; any Agent, or
a human at a CLI, must be equally valid. See `CORE_PRIMITIVES.md` §12, `ARCHITECTURE.md` §3.

**Artifact** — The OS-wide unit of any produced output: identity is always a content hash
(never a path or mtime, per `qc-skill`'s pattern), plus a type (video, audio, image,
subtitle document, project IR, → QCReport, analysis result, thumbnail, →
ProductionReceipt, → Timeline), a `stage` (working → candidate → approved → final →
archive), the → Operation and Skill+version that produced it, and parent/derived-from
links. CURRENT, adopted from `video-production-agent`'s `Artifact` dataclass and
generalized. See `CORE_PRIMITIVES.md` §7, `SPEC.md` §2.

**Capability** — A named, typed, versioned unit of "something the system can accomplish,"
independent of which → Skill implements it (e.g. `edit.trim`, `measure.audio.loudness`).
A Capability declares an id, input/output artifact types, a parameter schema, a
verification hint, and a lifecycle state; it is never itself an implementation — it is the
thing a → ProductionPlan refers to. FUTURE as a formal registry entity, CURRENT as an
informal concept (`SkillRegistry`'s abstract skill names, `ffmpeg-skill`'s
`capabilities.required/available`). See `CORE_PRIMITIVES.md` §1, `CAPABILITY_MODEL.md`.

**Capability Contract** — The published, machine-readable declaration a → Skill exposes so
it is discoverable: `skill_id`, `skill_version`, `contract_version`, its list of
`capabilities` (each with id, lifecycle, input/output schemas, artifact types,
`mutates_input`, `deterministic_inputs`, `idempotency_hint`, verification and security
fields), its `dependencies` on other Skills, and its self-declared `not_provided` list.
Generalizes `ffmpeg-skill`'s `ToolSpec` (introspected live from its own `argparse`
parsers) and every other Skill's `contract.py` output into one shape. See `SPEC.md` §1.

**Decision** — A typed, evidenced record of what should happen next: `subject`, `type`
(KEEP/REMOVE/TRANSFORM/DELIVER/SKIP/REVIEW/BLOCK), `risk`, `approval`
(AUTO/CONFIRM/BLOCK), `basis` (policy/preference/constraint provenance), and mandatory
`evidence`. Risk and approval are set independently of confidence, and a Decision is never
an implicit side effect of a measurement or a raw model completion — this is
`video-production-agent`'s existing `decision_engine.py` design, adopted as-is. See
`CORE_PRIMITIVES.md` §5.

**Event** — CURRENT, out of scope for the OS-level primitives this project defines; refers
to `video-production-agent`'s existing `temporal/timeline.py` concept of event history over
wall-clock/media time (which event kinds are "active" in a time range — a
session/observability concept). Not to be confused with an edit → Timeline; see the
**Timeline** entry below for the naming collision this project resolves.

**Inference** — An interpretation of one or more → Observations that must cite the
evidence it is based on (e.g. "this freeze is unwanted," derived from an Observation of a
freeze-frame). CURRENT, adopted as-is from `video-production-agent`. See
`CORE_PRIMITIVES.md` §5.

**Job** — One execution run of a → ProductionPlan; supports resume
(`render --resume last|JOB_ID`) via an Operation's → idempotency_key. CURRENT
(`video_agent.jobs.job`). See `CORE_PRIMITIVES.md` §11.

**Observation** — Evidence measured by a tool, tagged `provenance="OBSERVED"`, never
overwritten by → Inference (e.g. "there is a freeze from 00:31–00:34, 3.2s of
near-identical frames" — a `qc-skill`/`media-analysis-skill`-shaped fact). CURRENT,
adopted as-is. See `CORE_PRIMITIVES.md` §5.

**Operation** — One deterministic tool invocation compiled from an approved →
ProductionPlan step: `capability_id`, `provider_id`, `skill_id`, a typed
`argv_or_request` (never raw shell/filter strings), an → idempotency_key, and a
`timeout_seconds`. CURRENT, unchanged in shape from `video-production-agent`'s
`execution/compiler.py` → `Operation` chain. See `SPEC.md` §4.

**Pipeline** — Not a separate primitive: a named, reusable *shape* of → ProductionPlan (a
template), such as `video-production-agent`'s `profiles/` directory (`generic`, `youtube`,
`conference`). The commonly-drawn linear sequence (media-analysis → editing → audio →
color → subtitle → graphics → thumbnail → qc) is one shape a Plan's DAG can take, not a
mandated order. See `CORE_PRIMITIVES.md` §6/§11, `ARCHITECTURE.md` §6.

**Plan Validation** — The kernel's **structural** (never semantic) check of a →
ProductionPlan before execution: every `capability_id` resolves in the registry, every
input/output Artifact type is compatible with its Capability's declared types, the
`depends_on` graph is acyclic, and every step referencing a Capability with 2+ AVAILABLE
Providers has an explicit `provider_id` or a resolvable default-provider policy —
otherwise validation fails loudly with a named error rather than picking a → Provider
silently. "Is this a good plan" is Agent judgment, never a Plan Validation concern. See
`SPEC.md` §3, `ARCHITECTURE.md` §8 item 4, `EXECUTION_MODEL.md`.

**Production Context** — UNKNOWN as a distinct, separately-specified primitive in the
audited documents; not defined as its own named type in `CORE_PRIMITIVES.md`,
`CAPABILITY_MODEL.md`, `ARCHITECTURE.md`, or `SPEC.md` as of this writing. The closest
existing concepts are → Project (identity of one production) and → Workspace (filesystem
confinement) — if a distinct "Production Context" primitive is introduced later, it
should be defined relative to those two rather than assumed to be a third, overlapping
concept.

**ProductionPlan** — A DAG of `ProductionStep`s/Operations over Artifacts, derived from
approved → Decisions; `plan_status`/`step_status` are always computed from decision
states, never set by hand. Composability is answered by treating the Plan as a DAG, not a
fixed linear → Pipeline. CURRENT, adopted with a naming/documentation clarification (DAG,
not fixed pipeline) from `video-production-agent`'s existing plan/step model. See
`CORE_PRIMITIVES.md` §6, `SPEC.md` §3.

**ProductionReceipt** — The final, emitted-once → Artifact answering "what happened, why,
with what tools, did it pass verification" for one completed Plan: input/output Artifact
ids, `skill_versions`, `tool_versions`, the Decisions and → QCReports involved, warnings,
and failures. FUTURE — does not exist as a discrete artifact anywhere today, but is
directly buildable from `qc-skill`'s content-addressed identity scheme and
`video-production-agent`'s existing `ProjectIR.provenance` dict. See `CORE_PRIMITIVES.md`
§10, `SPEC.md` §6.

**Project** — The unit of identity for one production (one video being made), distinct
from a → Workspace (filesystem) and a → ProductionPlan (a Project can accumulate multiple
Plans over revisions). CURRENT (`ProjectIR`'s `project` section). See `CORE_PRIMITIVES.md`
§11.

**Provider** — One concrete implementation of a → Capability, registered under that
Capability's id (e.g. `measure.audio.loudness` has two Providers today, `qc-skill` and
`media-analysis-skill`, once formalized). A Skill can be a Provider of many Capabilities;
a Capability can have many Providers. Provider selection is always a Plan-time or
Agent-time decision, recorded in provenance — never a silent runtime default. FUTURE — does
not exist as a formal concept anywhere in the ecosystem today. See `CORE_PRIMITIVES.md`
§3, `CAPABILITY_MODEL.md`.

**QCCheck** — A named group of → QCFindings within a → QCReport (e.g. a "loudness" check
grouping several loudness-related findings). CURRENT, adopted verbatim from `qc-skill`.
See `CORE_PRIMITIVES.md` §9, `SPEC.md` §5.

**QCFinding** — A → QCMeasurement paired with a threshold judgment (`verdict`). CURRENT,
adopted verbatim from `qc-skill`. See `CORE_PRIMITIVES.md` §9, `SPEC.md` §5.

**QCMeasurement** — A raw measured number or fact (`name`, `value`, `unit`) with no
judgment attached — the atomic unit a → QCFinding is built from. CURRENT, adopted verbatim
from `qc-skill`. See `CORE_PRIMITIVES.md` §9, `SPEC.md` §5.

**QCReport** — The aggregate result of running QC checks: `overall_status` of
`PASS | WARN | FAIL | UNKNOWN` with worst-wins aggregation (never silently defaults to
PASS on empty input — it defaults to `UNKNOWN`), a list of → QCChecks, and an `identity`
value (`sha256` of a canonical JSON of skill/version/kind/operation/asset
fingerprints/parameters/rules/tool versions, explicitly excluding timestamps and paths).
CURRENT, copied verbatim from `qc-skill`'s implementation, not redesigned. A QCReport is a
fact, never an instruction to re-render or block — `qc-skill`'s own ADR-001 already
enforces this and the OS treats it as the reference implementation. See
`CORE_PRIMITIVES.md` §9, `SPEC.md` §5, `ARCHITECTURE.md` §3.

**Resource** — The (deliberately minimal) model of compute/hardware hints a Capability
Contract may declare (e.g. `requires_visual_verification`, `audio_only`,
`video_required`, already present in `ffmpeg-skill`'s ToolSpec) so an Agent can make a
cheap local-vs-not-applicable choice. FUTURE, intentionally minimal — no CPU/GPU/
concurrency scheduling exists in any audited repo, and none is invented here; a scheduler
is explicitly out of scope until there is evidence of a real need. See
`CORE_PRIMITIVES.md` §11, `ARCHITECTURE.md` §10.

**Runtime** — The OS-defined contract for how any Capability invocation actually
executes: process isolation, timeout and kill-tree semantics, environment scrubbing, path
containment, and the canonical → FORBIDDEN_KEYS denylist. Shipped as a reference library
(so Python Skills don't reimplement it) plus a conformance test suite for Skills in other
languages. CURRENT as a per-Skill pattern (five Skills independently converged on the same
adapter shape), FUTURE as a formalized, shared OS contract. See `CORE_PRIMITIVES.md` §4,
`CAPABILITY_MODEL.md`.

**Skill** — A versioned, independently deployable package that implements one or more →
Capabilities and exposes them through the OS's Capability Contract (see `SKILL_SPEC.md`).
Owns a coherent domain, its own security boundary, and its own release version. The 10
existing Skill repos are the current generation, not the definition of what a Skill is.
CURRENT. See `CORE_PRIMITIVES.md` §2. **See also the Skill Package vs SkillSpec entry
below for a real naming collision this term is involved in.**

**Skill Package vs SkillSpec (naming collision)** — `video-production-agent`'s own source
uses the word "Skill" for two different things: (a) an external repository/package
(internally, `SkillPackage`, e.g. the `ffmpeg-skill` repo) and (b) the agent's internal
notion of a production capability it knows how to plan for (internally, `SkillSpec`, e.g.
`silence_cleanup` — which is really a capability name, not a package). This is a real,
present ambiguity found directly in the audited source, not a hypothetical concern. **This
project's resolution:** the word **Skill** is reserved for meaning (a) only — an external
package (`SkillPackage`'s referent). Meaning (b) is renamed → **Capability** throughout
this project's documents; `SkillSpec`-shaped names like `silence_cleanup` are Capability
ids going forward. See `CORE_PRIMITIVES.md` §2, `REPOSITORY_MAP.md` (`video-production-agent`
§ "Terminology collision").

**Timeline (Edit Timeline vs Event Timeline — naming collision)** — A second real, present
naming collision found in the audit, distinct from the Skill/Capability one above.
`video-production-agent` already has a module called `temporal/timeline.py`, which models
**event history over wall-clock/media time** (an observability concept — see the
**Event** entry above) — not an **edit timeline** (clips, tracks, transitions, captions,
markers — an OpenTimelineIO-style domain model of an edited sequence), which does not
exist anywhere in the ecosystem today. **This project's resolution:** the two are treated
as distinct primitives that must not share a bare name. The existing one is called the
**Event Timeline** (module `temporal`, unchanged, out of `CORE_PRIMITIVES.md`'s scope).
The new one — proposed, modeled after OpenTimelineIO's clip/track/transition/marker shape —
is called the **Timeline** (bare) going forward and is **FUTURE** work, not implemented
today. See `CORE_PRIMITIVES.md` §8.

**Tool** — Not a distinct OS primitive; refers informally to a single callable operation
within a Skill's own interface (e.g. `ffmpeg-skill`'s 21 individual scripts — `cut`,
`fit`, `caption`, etc. — each called a "tool" in that repo's own docs, and its MCP
server's `tools/list`). Where this project needs a formal name for "one accomplishable
thing," it uses → Capability instead; "Tool" is kept only as the term for a Skill's own
internal, concrete entrypoint. See `REPOSITORY_MAP.md` (`ffmpeg-skill`).

**Workspace** — The unit of filesystem confinement in every Skill's → PathPolicy: a
directory boundary that outputs must live inside and inputs are resolved against.
CURRENT, already implemented this way in every audited Skill. See `CORE_PRIMITIVES.md`
§11.

---

## Ecosystem-specific terms

**FORBIDDEN_KEYS (also `FORBIDDEN_ARG_KEYS`)** — A parameter-key denylist every audited
Skill independently implements (with slightly different key sets) to block a caller from
injecting raw execution control — keys like `command`, `argv`, `shell`, `exec`,
`filter_complex`, `filter`, `api_key`, `token`, `env`. Checked recursively, before any
input reaches a code path that builds a subprocess argv or filter expression; a rejected
key must be an explicit error, never silently stripped. `SKILL_SPEC.md` §3.1 proposes the
canonical union of keys as a single OS-wide requirement, since today's per-repo lists
differ slightly. See `REPOSITORY_MAP.md` finding 3, `SKILL_SPEC.md` §3.1.

**PathPolicy** — The pattern every filesystem-touching Skill uses to confine reads/writes
to a declared → Workspace: resolving symlinks **before** the containment check (never
string-prefix matching, which is spoofable — this is `qc-skill`'s pattern and the
strongest one documented in the ecosystem). See `REPOSITORY_MAP.md` (`qc-skill` §Security),
`SKILL_SPEC.md` §3.3.

**contract_version vs skill.version** — Two intentionally separate version axes on every
Skill. `skill.version` (e.g. `0.9.1`) is the package's own release version and changes on
every release, including non-breaking ones. `contract_version` (e.g. `"1.0"`) only bumps
on a breaking change to the Skill's published → Capability Contract shape. A dependent
Skill must pin/range-check the *contract_version* of a dependency, never its
`skill.version` — this is already exactly how every delegating Skill checks `ffmpeg-skill`
today (`SUPPORTED_MIN`/`SUPPORTED_MAX`). See `REPOSITORY_MAP.md` (`ffmpeg-skill`
§Versioning), `SKILL_SPEC.md` §6, `VERSIONING.md`.

**idempotency_key** — A value carried by every → Operation, derived from
`{capability_id, provider_id, skill_version, params, input_artifact_ids}`, used to detect
whether an identical Operation already has a recorded successful `ExecutionResult` so a
resumed → Job (`render --resume last|JOB_ID`) can skip re-running it. CURRENT
(`Operation.idempotency_key`, `video-production-agent`). See `SPEC.md` §4,
`EXECUTION_MODEL.md`.

**lifecycle state (PROPOSED / EXPERIMENTAL / STABLE / DEPRECATED / RETIRED)** — The
five-state maturity model every → Capability declares independently of its Skill's own
release version. Deliberately shorter than a seven-state model that would also
distinguish ALPHA and BETA: the audit found no evidence any existing Skill distinguishes
those in practice (every Skill today is simply pre-1.0, `0.x`), so this project maps onto
what Skill authors already do rather than inventing unused granularity. See
`CAPABILITY_MODEL.md` §Capability lifecycle, `SPEC.md` §1.
