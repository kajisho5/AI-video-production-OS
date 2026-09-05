# Production Lifecycle: Project, Job, Revision, State, and Constraints

Status: **draft, evidence-based, 2026-09-05.** This document evaluates several stakeholder
proposals for new production-lifecycle nouns against what already exists in
`video-production-agent`, per this project's standing rule: no new primitive without
concrete, evidenced need (`CAPABILITY_MODEL.md`, `ARCHITECTURE.md` §9, lens 1). Several
claims below were verified directly against `video-production-agent`'s source tree during
this task (not only `REPOSITORY_MAP.md`'s prose), because the precise shape of existing
dataclasses and enums matters for whether a proposed addition is genuinely new or already
covered — this is noted inline wherever it goes beyond what `REPOSITORY_MAP.md` itself
states.

## How to read this document

Same CURRENT / FUTURE / EXPERIMENTAL / UNKNOWN tagging as every other document in this
project (`DESIGN_SYSTEM.md` §2), plus this document's frequent verdict shorthand:
**REJECT** (a proposed noun is evaluated and explicitly declined, with reasoning — not
silently ignored), **DEFERRED** (expressible via existing primitives today; not blocking
anything, revisit only with concrete evidence), and **PROPOSED** (a genuinely new,
justified addition). §(c) here (the state-machine mechanics) is intentionally narrow —
`PRODUCTION_STATE.md`, a sibling document, covers the production state model in more
depth; this document only establishes what state transitions already exist and how a
stakeholder's proposed state list maps onto them.

## (a) Project / Job / Run model

### The proposal

A stakeholder proposed introducing a separate **"Production"** noun sitting between
Project and Job/Run: `Project → Production → Version/Variant/Run`.

### What already exists (CURRENT)

`video-production-agent` already has a three-level hierarchy that expresses everything
this proposal is reaching for, using existing, verified primitives:

- **Project** (`CORE_PRIMITIVES.md` §11) — the `ProjectIR`'s `project` section, the unit of
  identity for one production (one video being made). CURRENT.
- **Plan, with revisions** — a Project accumulates multiple Plans over time as it is
  revised (`revision.md`, `ADR-034` in `video-production-agent`'s own decision log — see
  §(b) below for detail). Each Plan revision is a distinct, versioned, hash-identified
  object (`plan_hash`, `ir.version`). CURRENT.
- **Job** (`video_agent.jobs.job`) — one execution run of a Plan. `Job.status` is drawn
  from a 14-value state enum (`JOB_STATES`, verified directly in
  `src/video_agent/models/__init__.py`: `QUEUED, INGESTING, ANALYZING, PLANNING,
  WAITING_FOR_APPROVAL, EXECUTING, QA, RECOVERY, REVIEW, DELIVERING, COMPLETED, FAILED,
  BLOCKED, CANCELLED`), and supports resume via `Operation.idempotency_key`
  (`render --resume last|JOB_ID`, `EXECUTION_MODEL.md` §3). CURRENT.

This is already exactly "a project can have multiple revised plans, each executed as one or
more jobs" — the proposal's own framing — without a fourth noun.

### Verdict: REJECT

**Introducing a "Production" primitive is rejected.** Reasoning:

1. **No repo in the audited ecosystem has anything resembling it.** `REPOSITORY_MAP.md`'s
   evidence-first standard applies here directly: a primitive with zero grounding in any of
   the 11 repos is exactly the "abstraction without concrete value" `CAPABILITY_MODEL.md`
   and `ARCHITECTURE.md` §9 (lens 1) argue against.
2. **The existing hierarchy already expresses the same relationship.** Project → Plan
   (revision) → Job (run) already means "one identity for the production, multiple revised
   courses of action for it, one or more execution runs per course of action." Inserting
   "Production" between Project and Plan/Job would either (a) duplicate Project (if it
   means "one video being made," that is what Project already means), or (b) duplicate
   Plan (if it means "one approved course of action," that is what a Plan revision already
   means) — neither reading adds a distinction the existing two levels don't already make.
3. **This does not foreclose the underlying need.** If the stakeholder's actual concern is
   "I want to compare two different edits of the same source material side by side" (a
   Variant/Candidate concern), that is a real, separate question — addressed directly and
   affirmatively in §(b) below, using existing primitives, not a new noun.

## (b) Revision model

### What already exists (CURRENT)

`video-production-agent` already has real, working revision support:

- `project/migrations.py` (file confirmed present directly in the source tree) and
  `docs/revision.md` describe a Plan-revision mechanism: a Project's Plan can be revised
  into a new version, and the previous version is preserved, not overwritten (confirmed by
  the `revise` CLI command's own help text: "produce the next plan version from rejections
  and feedback (previous version is preserved)").
- **ADR-034** ("revision integrity: preserve decision evidence across plan versions",
  `video-production-agent`'s own `docs/decisions.md`) is the governing decision here: when
  a Plan is revised, the Decision evidence backing earlier, still-relevant choices is
  preserved across the version boundary, not discarded and re-derived from scratch. A
  revised plan version also requires **re-approval** even if no `CONFIRM` decisions remain
  pending (verified directly: `revision.approved_plan_version != plan.version` forces
  `WAITING_FOR_APPROVAL` regardless of pending-decision count) — a deliberate, evidenced
  safety property: approving v1 never silently carries forward to approving v2.

### The proposal: Variant / Candidate

A stakeholder proposed a **Variant** or **Candidate** concept — e.g. a "Social Cut" and a
"Festival Cut" sharing the same source Artifacts but diverging in edit decisions — plus
what-if multi-plan comparison.

### Verdict: DEFERRED — expressible today, not blocking anything

**A Variant is expressible today as simply another Project (or another Plan under the same
Project) pointing at the same source Artifact ids.** No new primitive is needed:

- If "Social Cut" and "Festival Cut" are understood as two independent productions that
  happen to share source material, they are naturally **two Projects**, each with its own
  Plan/Job history, both referencing the same input `Artifact` ids (`Artifact.derived_from`
  / `Artifact` identity is content-hash-based per `SPEC.md` §2, so two Projects referencing
  the same source Artifact is already a well-defined, supported relationship — nothing about
  Artifact identity assumes a single owning Project).
- If they are understood as two divergent courses of action *within* the same production
  (same Project), they are naturally **two Plans under the same Project**, each with its
  own `plan_hash`/`ir.version`, exactly the revision mechanism already described above,
  just not linearly superseding one another.

**What-if multi-plan comparison** (viewing two Plans' projected or actual outputs side by
side) is not implemented anywhere today and is not designed here — it is a read-only,
presentation-layer concern over data that already fully exists (two Plans, each with their
own Artifacts and QCReports), not a data-model gap. Marking this **DEFERRED**, not
**REJECT**, because unlike "Production" (§(a)), there is no reason to believe a future,
evidenced need for an explicit `Variant`/`Candidate` type won't emerge — it simply hasn't
yet, and today's primitives already express the relationship without blocking any current
work.

## (c) Production state model — the state-machine aspect

**Scope note:** `PRODUCTION_STATE.md` (a sibling document) covers the production state
model in more depth. This section covers only: what state transitions already exist today,
and how a stakeholder's proposed unified state list maps onto them.

### What exists today (CURRENT) — four independent, already-composable state axes

`video-production-agent` does not have one state machine; it has **four**, each verified
directly against the source and each already answering a different question:

1. **`Job.status`** (`JOB_STATES`, `src/video_agent/models/__init__.py`) — "where is this
   execution run in its lifecycle": `QUEUED, INGESTING, ANALYZING, PLANNING,
   WAITING_FOR_APPROVAL, EXECUTING, QA, RECOVERY, REVIEW, DELIVERING, COMPLETED, FAILED,
   BLOCKED, CANCELLED`.
2. **`Artifact.stage`** (`ARTIFACT_STAGES`) — "how promoted is this specific output":
   `working → candidate → approved → final → archive`.
3. **`Artifact.qa_status`** — "did this output pass verification": `PENDING | PASS | WARN
   | FAIL | UNKNOWN` (mirrors `QCReport.overall_status` exactly, `SPEC.md` §5).
4. **`Artifact.delivery_status`** — "is this output actually delivered," verified directly
   as its own field with its own comment describing it precisely as **"a view of stage"**:
   `NOT_READY | READY | DELIVERED | ARCHIVED`.
5. **`Decision.approval`/`Decision.status`** (`CORE_PRIMITIVES.md` §5) — "is this specific
   choice authorized to execute": `approval ∈ {AUTO, CONFIRM, BLOCK}`, `status ∈ {PROPOSED,
   APPROVED, REJECTED, BLOCKED}`.

These five state fields, taken together, already cover essentially the entire state space a
production lifecycle needs — and they compose because they answer *different* questions
about *different* objects (a Job, an Artifact, a Decision), not the same question five
different ways.

### The proposal: a unified 12-state list

A stakeholder proposed: `DRAFT, PLANNED, READY, RUNNING, PAUSED, FAILED,
WAITING_FOR_APPROVAL, QC_PENDING, QC_FAILED, VERIFIED, DELIVERED, ARCHIVED`.

### Verdict: do not introduce a new parallel state machine — compose the existing ones

Mapping the proposal directly onto what already exists, term by term:

| Proposed state | Already expressed as |
|---|---|
| `DRAFT` | `Job.status ∈ {QUEUED, INGESTING, ANALYZING}` — before a Plan exists |
| `PLANNED` | `Job.status == PLANNING`, or a Plan exists with pending `Decision.status == PROPOSED` |
| `READY` | The moment all required `CONFIRM` decisions reach `Decision.status == APPROVED` — a transition, not a persisted state in the current model (see gap below) |
| `RUNNING` | `Job.status == EXECUTING` |
| `PAUSED` | **No exact existing equivalent — see honest gap, below** |
| `FAILED` | `Job.status == FAILED` — exact match, verbatim |
| `WAITING_FOR_APPROVAL` | `Job.status == WAITING_FOR_APPROVAL` — exact match, verbatim, already the literal string in `JOB_STATES` |
| `QC_PENDING` | `Job.status == QA` (job currently in its QA phase), or `Artifact.qa_status == PENDING` |
| `QC_FAILED` | `Artifact.qa_status == FAIL` (or `QCReport.overall_status == FAIL`) — **this already exists via `qc-skill`'s verdict and does not need a new enum value** |
| `VERIFIED` | `Artifact.qa_status == PASS` (or `WARN`, policy-dependent) |
| `DELIVERED` | `Artifact.delivery_status == DELIVERED` — exact match, verbatim, already the literal string, set by the existing `deliver` CLI command ("promote a QA-passed artifact of an approved plan to DELIVERED") |
| `ARCHIVED` | `Artifact.stage == archive`, or `Artifact.delivery_status == ARCHIVED` — exact match, verbatim |

**Ten of the twelve proposed states already map onto an existing field, and two of them
(`WAITING_FOR_APPROVAL`, `DELIVERED`) are already the literal, verbatim string value in
existing code today** — this is unusually strong evidence against introducing a parallel
enum: the stakeholder's proposed vocabulary and the existing implementation's vocabulary
have already converged independently in two places.

**Recommendation: do NOT introduce a new, parallel state machine.** Instead, document the
composition above as the answer to "what state is this production in" — a query over the
existing `Job.status` + `Artifact.stage` + `Artifact.qa_status` + `Artifact.delivery_status`
+ `Decision.approval/status` tuple, not a new field anywhere. `PRODUCTION_STATE.md` is the
right place to formalize this composed view in detail; this document establishes only that
composing is the correct approach and that the mapping above is not speculative — nine of
the ten covered states above have a direct, named, already-implemented field behind them.

**Honest gap: `PAUSED` and `READY` have no exact existing equivalent.** Per
`EXECUTION_MODEL.md` §5.1, a Plan execution that stops before reaching a terminal state
(interrupted, timeout exhausted, human interruption) is inferred from "some prefix of the
Plan's steps completed" plus the Job's own idempotency-key record — there is no dedicated
`PAUSED` value in `JOB_STATES` today, and `READY` (the instant between full approval and
execution starting) is a transition the current code passes through atomically rather than
a state it persists. This document does not propose adding either as new enum values now —
whether `PAUSED` deserves to be one additional literal value in the existing `JOB_STATES`
tuple (an additive change to an existing enum, not a new state machine) is exactly the kind
of small, evidence-triggered refinement `PRODUCTION_STATE.md` should resolve once it
establishes whether "a Job that stopped without reaching a terminal state" needs to be a
first-class, queryable fact rather than something inferred after the fact. Named here as an
open question, not silently resolved either way.

## (d) Constraint system

### What already exists (CURRENT — verified directly, with one precision correction)

`Policy`, `Preference`, and `Constraint` **already exist as a formal, typed concept** in
`video-production-agent`'s `policy/rules.py` — **this is CURRENT, not a new proposal.**
One precision worth stating exactly, because it was verified directly against the source
and is more precise than "three distinct dataclasses": the three are not three separate
classes, but three **`kind`** values (`KINDS = ("POLICY", "PREFERENCE", "CONSTRAINT")`) of
one `Rule` dataclass (`id, kind, scope, key, value, source`), with a derived `hard` property
(`hard == (kind == "CONSTRAINT")`). Precedence is resolved by `scope`
(`GLOBAL → ORGANIZATION → EVENT → PROJECT → PROFILE → REQUEST`), and — critically — a
`CONSTRAINT`-kind rule is **never overridden**: a lower-precedence rule that conflicts with
an existing `hard` rule is recorded as a `Conflict` for the decision engine, not silently
applied (`resolve_rules()`, verified directly). This is a real, working, already-correct
design, not something this document proposes building.

### What is genuinely new here

**1. Explicitly splitting Constraint into Hard vs. Soft — PROPOSED refinement.**

Today, `hard` is a strict binary already derived from `kind`: every `CONSTRAINT`-kind rule
is unconditionally hard (never overridden, conflicts recorded), and every `POLICY`/
`PREFERENCE`-kind rule is unconditionally soft (lower precedence wins per scope order, no
conflict recorded). There is **no intermediate tier today** — no way to express "this is a
constraint, strongly weighted, but overridable with a recorded justification," distinct
from a full `PREFERENCE` (freely overridden) on one side and an absolute `CONSTRAINT`
(never overridden, no exception path) on the other. The genuinely new piece this document
proposes is introducing that middle tier — a **Soft Constraint**: still `kind ==
"CONSTRAINT"` in spirit (a real limit, not a mere preference), but one whose violation
produces a recorded, evidenced `Decision` requiring explicit approval rather than an
automatic `Conflict` rejection. This is marked **PROPOSED**, not built — it is a
refinement of an already-correct design, not a redesign of it, and it does not change the
existing binary behavior for anything already classified as `CONSTRAINT` or `PREFERENCE`
today.

**2. Permissions, scoped to Runtime-boundary actions — PROPOSED/FUTURE.**

A **Permission** is a distinct concept from a Constraint/Policy/Preference: it governs
whether an Operation may cross a **Runtime trust boundary** at all (network access,
external upload, overwriting an existing Artifact) rather than expressing a production
judgment (technical or creative). **No repository in the audited ecosystem has any network
access today** — `SPEC.md` §7 states plainly "no repo in the ecosystem talks to a network
service today; this is out of scope until one does," and every audited Skill's security
model (`ARCHITECTURE.md` §7) is built entirely around filesystem and subprocess boundaries,
not network ones. **There is nothing to permission yet.** This is marked
**PROPOSED/FUTURE** for exactly that reason — not because the concept is wrong, but because
building a Permission system now would be designing for a capability (network access) that
does not exist anywhere in this ecosystem, the same architecture-astronautics failure mode
`ARCHITECTURE.md` §9 (lens 5) and §10 (Resource model) already decline elsewhere. The
concept is named here **so it exists before any Skill ever needs network access** — the
recommendation is to reserve the name and the boundary (Runtime-scoped, not
production-judgment-scoped) now, not to design its schema now.

### A real failure mode worth naming explicitly

**The Agent must never treat a Preference as a Hard Constraint, or vice versa.** This is
not a nice-to-have — it is a concrete correctness rule, directly motivated by
`resolve_rules()`'s own existing behavior: a `CONSTRAINT`-kind rule is designed to win
unconditionally and record a `Conflict` when something tries to override it; a
`PREFERENCE`-kind rule is designed to be freely overridden by scope precedence with no
conflict recorded at all. An Agent (today's or a future one) that mis-classifies a user's
stated preference as a hard constraint would silently refuse legitimate overrides that
should have succeeded; one that mis-classifies an actual hard constraint as a preference
would silently permit exactly the kind of violation `CONSTRAINT`'s "never overridden"
guarantee exists to prevent. Because this is a classification decision made by Agent logic
at the point a `Rule` is created (not something the OS's `Rule`/`RuleSet` shape can enforce
structurally after the fact — the shape is deliberately generic across all three kinds),
this is named here as an explicit Agent-authoring discipline rule, worth stating in
`SKILL_SPEC.md`/`SECURITY_MODEL.md`-adjacent guidance wherever Agent authors are told how to
construct `Rule`s, not merely implied by the existence of the `kind` field.

## (e) Confidence and evidence in Decisions

See also the corresponding addition made directly to `CORE_PRIMITIVES.md` §5 as part of
this task — this section gives the fuller reasoning; that document carries the short,
canonical version.

### What the prior audit left open, and what this document resolves

`REPOSITORY_MAP.md`/`CORE_PRIMITIVES.md` note that `decision_engine.py`'s own docstring
states "Decisions carry risk and approval independently of confidence" — establishing that
a **confidence concept** already exists in that module's reasoning, but the prior audit did
not verify whether `confidence` is a **formal typed field on the `Decision` dataclass
itself** (that was left as UNKNOWN, correctly, since it had not been checked).

**This document performs that verification directly against the source, closing the
question: `confidence: float` is already a required field (no default value) on both
`Inference` and `Decision` in `src/video_agent/models/__init__.py`.** This upgrades the
prior UNKNOWN to **CURRENT** — `confidence` is not merely referenced in a docstring, it is
already a mandatory part of the `Decision` type's real shape, populated from the
originating `Inference`'s confidence at the point `decision_engine.py`'s `decide()`
constructs the `Decision` (`confidence=float(confidence)`, verified directly). The
docstring's principle — "risk and approval are set independently from confidence" — is a
statement about how those *other* fields are derived (from policy and the kind of change,
never from this one), not a statement that confidence itself is absent from the type.

### What this means for the OS contract

Because `confidence` is already required on `Decision` in the one Agent that exists, this
document does **not** propose adding it as a new field. What it does recommend, precisely:

- **Keep `confidence` where it is already meaningful (`Inference`, `Decision`) and reject
  putting it on every field/type as a matter of course.** `ProductionPlan`, `Operation`,
  `Artifact`, and `QCReport` have no confidence concept today and should not gain one
  speculatively — `QCReport`'s findings are measured facts (`PASS/WARN/FAIL/UNKNOWN`, worst-
  wins), not probabilistic judgments, and adding a confidence field there would blur exactly
  the fact/interpretation boundary `CORE_PRIMITIVES.md` §5 is designed to keep sharp. This is
  the addendum's own over-design warning, applied concretely: do not propagate a field
  everywhere just because it exists somewhere useful.
- **Whether `confidence` should become `Optional[float]` rather than required is a real,
  narrow, separate question this document surfaces but does not resolve** — some Decisions
  (a fact-backed safety Decision with `basis.approval.served == None`, per the existing
  `basis` shape's own comment: "None: a fact-backed / safety decision, not what was asked")
  may not have a meaningful originating Inference confidence to inherit. Changing an
  existing required field to optional is a breaking shape change and is named here as an
  open question for whoever owns the eventual `avpos-contracts` extraction
  (`AGENT_EVOLUTION.md` §1.2), not decided in this document.

### Evidence is not raw data

**`Decision.evidence` and `Inference.evidence` are already, today, `List[str]` — id
references to Observations/Events, not embedded copies of the underlying data** (verified
directly: both fields are typed `List[str]` in `models/__init__.py`, holding "observation
ids / event ids"). This is worth stating as an explicit, named principle even though the
code already does it correctly, because it is easy for a future Agent author (or a future
OS contract revision) to get this wrong by convenience: **Evidence is the minimal,
structured justification for an Inference or Decision — a small set of citations — not a
dump of raw Observations.** A Decision that embedded full Observation payloads instead of
citing their ids would make provenance harder to audit (duplicated, potentially
inconsistent copies of the same fact), not easier, and would work against the exact
content-hash/identity discipline `ARTIFACT_MODEL.md` and `qc-skill`'s identity scheme
already apply everywhere else in this ecosystem. This document's contribution is naming the
principle explicitly so it survives being restated correctly the next time someone writes a
new Agent against these contracts, not changing anything about the current, already-correct
behavior.

## What this document deliberately does not define

- **A `Production` primitive.** Explicitly rejected in §(a), with reasoning — not silently
  omitted.
- **A `Variant`/`Candidate` type or a multi-plan comparison UI/data model.** Deferred in
  §(b) — expressible today, revisit only with concrete evidence of a real blocker.
- **The full production state model.** Covered only at the state-transition-composition
  level in §(c); the deeper model is `PRODUCTION_STATE.md`'s job.
- **A `Permission` schema.** Named as a reserved concept in §(d), not designed — there is
  nothing to permission until a Skill needs network access.
- **Whether `Decision.confidence` should become optional.** Surfaced as an open question in
  §(e), not resolved — it is a breaking shape change with no urgent evidenced need yet.
