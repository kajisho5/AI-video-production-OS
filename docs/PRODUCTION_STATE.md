# Production State: a Query, Not a New Stored Object

A stakeholder proposed "Production State" — the current status of a Production, spanning
Intent, Goals, Constraints, Policy, Preferences, Source Assets, Observations, Decisions,
Plan, Operations, Artifacts, QC Reports, Verification State, Delivery State, and
Provenance — as a possible central OS concept, with an explicit warning against turning
it into "one giant JSON structure." This document takes that warning seriously and
concludes: **every one of those fourteen elements already exists, individually, as a
CURRENT or already-PROPOSED primitive elsewhere in this project's documents.**
"Production State" is not a new thing to store — it is a **name for a read-only query
across primitives that already have their own identity, their own owner, and their own
lifecycle.** Storing it as one mutable object would recreate, inside a fifteenth
structure, the exact duplication-of-truth problem `CAPABILITY_MODEL.md` was written to
fix for a different pair of Skills (§1 below draws that parallel explicitly).

## 1. Why a stored object is the wrong shape — the qc-skill/media-analysis-skill parallel

`CAPABILITY_MODEL.md`'s entire argument exists because `qc-skill` and
`media-analysis-skill` each independently implemented loudness, silence, and
decode-integrity measurement with **no shared identity between them**
(`REPOSITORY_MAP.md` finding 2) — the same fact, computed twice, with nothing in the
system able to notice they were the same fact. `PRINCIPLES.md` Principle 3 states the
general lesson: "What can be accomplished" and "what package ships the code" must be two
different, separately-named concepts, because conflating them already produced a real
defect.

A stored, mutable "Production State" object would reproduce this exact failure mode, one
level up: it would need a `qc_reports` field alongside `qc-skill`'s own `QCReport`
artifacts, an `artifacts` field alongside the actual `Artifact` records, a `decisions`
field alongside the actual `Decision` log. The moment a `QCReport` is re-run, or a new
Decision is made, or an Artifact is promoted from `working` to `final`, the stored
Production State object either goes stale (a second source of truth silently drifting
from the first) or must be re-synchronized on every single write anywhere else in the
system (a state-management burden with no evidence anywhere in the audited ecosystem that
anything currently needs it — the exact "architecture astronautics" `PRINCIPLES.md`
Principle 10 argues against). Every audited repo already avoids this trap in its own
domain — `plan_status`/`step_status` are "always computed from decision states, never set
by hand" (`CORE_PRIMITIVES.md` §6), and Artifact `stage` transitions are "not
self-reported by a Skill" but derived from the same discipline (`ARTIFACT_MODEL.md` §5).
A stored Production State object would be the one place in the whole system that
*doesn't* follow that discipline, for no evidence-backed reason.

**The decision this document makes and justifies for the rest of its length: Production
State is a derived VIEW/QUERY over existing primitives, computed on demand by reading
their current values, never a new stored object with its own write path.**

## 2. Walking every element against what already exists

Each element below is graded CURRENT (the underlying primitive is verified in the
audited ecosystem), PROPOSED (the underlying primitive is a refinement this project's
documents already propose), or FUTURE (no current implementation, named as a gap). None
of the fourteen elements requires new storage — each maps onto a primitive with its own
document, and Production State's only job is to know where to look.

### Intent, Goals, Constraints, Policy, Preferences

Maps directly onto `INTENT_MODEL.md`'s decomposition, which this document does not
restate in full — see that document for the complete grading of each sub-element. In
summary: `Policy` and `Preference` are **CURRENT** types in `video-production-agent`'s
`policy/rules.py` (`INTENT_MODEL.md` §4–§5, `CORE_PRIMITIVES.md` §5's `Decision.basis`,
`PRINCIPLES.md` Principle 4); Hard/Soft Constraints are a **PROPOSED** refinement of the
existing `Constraint` type (`INTENT_MODEL.md` §2–§3); Goals are **UNKNOWN** as a formally
separate type (`INTENT_MODEL.md` §1); Creative Intent is **PROPOSED** as a small set of
loosely-typed free-text fields, deliberately not enumerated (`INTENT_MODEL.md` §7); and
Permissions is **FUTURE**, a named placeholder with no current use case
(`INTENT_MODEL.md` §6). All of these already live at the **Project** level
(`CORE_PRIMITIVES.md` §11: Project is "the unit of identity for one production") — a
Production State query for these elements is a read of the current Project's Intent
record, not a new store.

### Source Assets, Artifacts

**CURRENT.** Both are `Artifact` records (`CORE_PRIMITIVES.md` §7, `SPEC.md` §2,
`ARTIFACT_MODEL.md`) distinguished by `stage` (`working → candidate → approved → final →
archive`) and by whether they are an input the Project started with or an output a Plan's
Operations produced. There is no separate "Source Asset" type to invent — a source asset
is simply an `Artifact` with no `produced_by.operation_id` inside the current Plan (it
predates the Plan, per `ARTIFACT_MODEL.md` §3's discussion of what `derived_from` would
express once built). Querying "what are this Production's current Source Assets and
Artifacts" is a filtered read over the Project's Artifact set, keyed by `stage` and by
whether an Artifact has a `produced_by` pointing into the current Plan's Operations.

### Observations, Decisions

**CURRENT.** Both are typed records per `CORE_PRIMITIVES.md` §5, adopted as-is from
`video-production-agent`: an Observation is evidence measured by a tool
(`provenance="OBSERVED"`, never overwritten by inference); a Decision is `subject`,
`type` (KEEP/REMOVE/TRANSFORM/DELIVER/SKIP/REVIEW/BLOCK), `risk`, `approval`
(AUTO/CONFIRM/BLOCK), `basis`, and mandatory `evidence`. Querying "what has been observed
and decided so far" is a read of the Project's Observation and Decision logs — logs that
already exist as the record of what happened, not a summary that needs to be separately
maintained.

### Plan, Operations

**CURRENT.** `ProductionPlan` is a DAG of `ProductionStep`s/Operations over Artifacts,
`plan_status`/`step_status` always computed from Decision states, never set by hand
(`CORE_PRIMITIVES.md` §6, `SPEC.md` §3). Operations are the compiled, typed tool
invocations (`SPEC.md` §4, `EXECUTION_MODEL.md` §1.1–§1.2). Querying "what is this
Production's current Plan and where is execution within it" is a read of the current
`ProductionPlan`'s step statuses plus the `Job`'s idempotency-key record of which
Operations have a recorded successful `ExecutionResult` (`EXECUTION_MODEL.md` §3.1,
§5.1 — "the checkpoint" already **is** this information, nothing new to compute it from).

### QC Reports, Verification State

**CURRENT for QCReport; the stakeholder's proposed Verification State enum is explicitly
REJECTED.**

`QCReport` (`overall_status: PASS | WARN | FAIL | UNKNOWN`, worst-wins aggregation, never
silently defaults to PASS on empty input) is adopted verbatim from `qc-skill`
(`CORE_PRIMITIVES.md` §9, `SPEC.md` §5, `QC_ARCHITECTURE.md` §1). This document does
**not** introduce a new six-state `Verification State` enum
(`UNVERIFIED/PASS/PASS_WITH_WARNINGS/FAIL/BLOCKED/UNKNOWN`) as literally proposed. The
rejection, stated precisely rather than by assertion:

- `qc-skill`'s existing `PASS/WARN/FAIL/UNKNOWN` already covers every state the proposed
  enum's technical-verification cases describe: `UNVERIFIED` is `UNKNOWN` (no checks ran
  yet — already the documented default, never conflated with a silent `PASS`,
  `QC_ARCHITECTURE.md` §1); `PASS_WITH_WARNINGS` is not a distinct state at all under
  worst-wins aggregation, it is simply a `QCReport` whose `overall_status` is `WARN` with
  one or more `PASS`-level findings alongside the warning findings — the detail the
  proposed name is trying to capture is already fully present in the `checks: [QCCheck]`
  list underneath the single `overall_status` value, not lost by using four states
  instead of six.
- `BLOCKED` (and, implicitly, "waiting for approval") is already covered by
  `Decision.approval` (`AUTO/CONFIRM/BLOCK`, `CORE_PRIMITIVES.md` §5) — a `BLOCK` is a
  property of a *Decision*, not a property of a *QCReport*. `qc-skill`'s own ADR-001 (`QC
  does not make production decisions`, `QC_ARCHITECTURE.md` §3, `ARCHITECTURE.md` §3) is
  exactly the boundary this rejection defends: a QC verdict is a fact about measured
  reality; whether that fact results in a block is a Decision, with its own `approval`
  state, made by an Agent. Folding `BLOCKED` into a QC-adjacent Verification State enum
  would blur precisely the line `qc-skill`'s own code enforces by construction — it would
  let a verification artifact carry a decision-shaped value.

Introducing a sixth parallel enum for a fact `qc-skill`'s existing four-state model and
`Decision.approval`'s existing three-state model already jointly cover would create **two
sources of truth for the same fact** — exactly the class of unjustified duplication
`CAPABILITY_MODEL.md`'s entire argument (the `qc-skill`/`media-analysis-skill` collision,
`REPOSITORY_MAP.md` finding 2) exists to warn against, applied here to two *state
representations* of the same underlying facts rather than two *measurement
implementations*. `PRINCIPLES.md` Principle 3's rule — "what can be accomplished" and
"what package ships the code" must be two different, separately-named concepts, but
never invent a *third*, *redundant* one covering the same ground as the first two — is the
same discipline this rejection applies.

**What "Verification State," as a query concept rather than a stored enum, actually is:**
the current `QCReport.overall_status` for the Artifact(s) in question, joined with the
`Decision.approval` state (if any) of the Decision that consumed that report. This is two
existing field reads, not a new state machine.

### Delivery State

**CURRENT, no new concept needed.** Delivery State maps onto `Artifact.stage` reaching
`final` or `archive` (`ARTIFACT_MODEL.md` §5) plus a `Decision` of `type = DELIVER`
(`CORE_PRIMITIVES.md` §5's Decision type enum already includes `DELIVER`) authorizing
that promotion. "Has this Production been delivered" is answerable by checking whether
the Project's current Plan has a `final`-stage Artifact with a `DELIVER` Decision in its
provenance chain — again, a read across two existing fields, not a new stored flag.

### Provenance

**CURRENT/PROPOSED, per `PROVENANCE.md` — nothing new here.** Per-Artifact provenance
(the `provenance` dict already carried by every Artifact, `SPEC.md` §2) and the roll-up
`ProductionReceipt` (**PROPOSED**, `PROVENANCE.md` §4, `SPEC.md` §6) are the complete
answer to "what happened, why, with what tools, did it pass verification" for a
Production. Production State's Provenance element is simply a read of these — either the
per-Artifact provenance for one Artifact in question, or the `ProductionReceipt` once one
exists for a completed Plan.

## 3. What "querying the Production State" means, concretely

Putting §2 together: **"querying the Production State" is reading the current Project's
latest Plan, its Artifacts (filtered by stage), its latest relevant QCReport(s), and its
Decision log — a read operation across existing OS contracts, not a new stored
primitive.** Nothing above requires a write path of its own; every element is already
written by the primitive that owns it (a Decision is written when the Agent decides one,
a QCReport when a verification Capability runs, an Artifact when an Operation completes).

This keeps the OS from inventing a giant mutable object that would become a second
source of truth alongside the Observation/Inference/Decision/Plan/Artifact/QCReport
primitives that already track this information individually and are already, per
`ARCHITECTURE.md` §2, the parts of the ecosystem this project explicitly commits to not
discarding because they are already correct.

### A read-only projection shape (PROPOSED, genuinely new — small and low-risk)

`REPOSITORY_MAP.md` does not identify any single consolidated status view in
`video-production-agent` today — the audit found `--dry-run`/`--json` on individual
commands (`PRINCIPLES.md` Principle 11) and a `doctor` capability-availability report
(`SKILL_SPEC.md` §1, referenced via `ARCHITECTURE.md` §9 lens 11), but no single command
or function that answers "what is the current state of this whole Production" by reading
across Plan + Artifacts + QCReports + Decisions together. This is a genuine, small gap —
not a primitive gap (every underlying piece exists), a **surfacing** gap.

This document proposes filling it with exactly one thing: a **read-only aggregation
function** (usable as a CLI `status` command, or as an Agent's context-gathering step
before reasoning about what to do next) that performs the reads described in §2 and
returns a projection shaped roughly like:

```
ProductionStateSummary {           // PROPOSED — a query response shape, not a stored type
  project_id: string
  intent: {                        // read from the Project's Intent record — INTENT_MODEL.md
    goals, hard_constraints, soft_constraints, preferences, policy,
    permissions, creative_intent
  }
  plan: {                          // read from the current ProductionPlan
    plan_id, plan_hash, step_statuses: [{step_id, status}]
  }
  artifacts: {                     // read from the Project's Artifact set, by stage
    working: [ArtifactId], candidate: [ArtifactId],
    approved: [ArtifactId], final: [ArtifactId], archive: [ArtifactId]
  }
  latest_qc: {                     // read from the most recent QCReport(s) for current-stage Artifacts
    [artifact_id]: { overall_status, identity }
  }
  decisions: {                     // read from the Decision log, most recent first
    pending_approval: [DecisionId],   // approval == CONFIRM/BLOCK and not yet resolved
    recent: [DecisionId]
  }
  delivery: {                      // derived from Artifact.stage + DELIVER Decisions
    delivered: bool, final_artifact_ids: [ArtifactId]
  }
  as_of: timestamp                 // when this projection was computed — NOT part of any identity/hash,
                                    // per PRINCIPLES.md Principle 18 (timestamps never belong in an identity key)
}
```

Every field above is a read from a primitive defined elsewhere in this project — `intent`
from `INTENT_MODEL.md`, `plan` from `SPEC.md` §3, `artifacts` from `ARTIFACT_MODEL.md`,
`latest_qc` from `QC_ARCHITECTURE.md` §1, `decisions` from `CORE_PRIMITIVES.md` §5,
`delivery` from §2's Delivery State reasoning above. `as_of` is explicitly **not** part
of any content-hash or identity scheme this projection might carry (it wouldn't have
one — this is a transient response, not an Artifact), consistent with
`PRINCIPLES.md` Principle 18's rule that identity/reproducibility keys must exclude
anything that changes without changing the answer; a `ProductionStateSummary` is exactly
the kind of value that recomputing five minutes later may validly differ (a new
Observation arrived, a Decision was made), so it is not itself content-addressed the way
an `Artifact` is — it's a live view, not a fact worth hashing.

**This is proposed as genuinely new, low-risk, and small:** it is one aggregation
function/CLI command, not a new stored data model, not a new contract type other Skills
must conform to, and not a new primitive `CORE_PRIMITIVES.md` needs to define. It sits
entirely on the Agent/consumer side of the OS/Agent boundary (`ARCHITECTURE.md` §3) —
the OS doesn't need to know this projection exists, because it introduces no new type
the kernel (`ARCHITECTURE.md` §8) has to validate, store, or execute against. Any Agent
(today's `video-production-agent`, a future one, or a human at a CLI) can build this
same projection independently from the same underlying reads, without coordination,
which is exactly the property a derived view should have and a shared mutable object
would not.

## 4. What can be tracked mechanically today vs. what's a genuine gap

Not every question "Production State" might be asked to answer is answerable purely by
reading current primitive values. Distinguishing these honestly matters:

**Mechanically answerable today** (a pure read, per §2–§3): current Plan status, which
Artifacts exist at which stage, the latest QCReport per Artifact, the Decision log,
whether a DELIVER Decision + final-stage Artifact exist. All of this is a projection over
data every audited primitive already produces as a byproduct of doing its job.

**A genuine gap, correctly scoped as FUTURE, not answerable by a read alone:** "given
that source asset X changed, what parts of the current Plan's output are now stale and
should be re-executed?" This is not a Production State query problem — it is the
**incremental-rebuild problem**, and it requires exactly the machinery
`EXECUTION_MODEL.md` names but does not build: a DAG of Operations over content-hashed
Artifacts (`ARCHITECTURE.md` §6, `CORE_PRIMITIVES.md` §6) plus an `idempotency_key`
derived from `{capability_id, provider_id, skill_version, params, input_artifact_ids}`
(`EXECUTION_MODEL.md` §3.2) is exactly the information needed to determine "which
downstream Operations had an input whose content hash changed, transitively" — but
`EXECUTION_MODEL.md` §3.3 explicitly marks **cross-run cache reuse** (using a matching
`idempotency_key` from a *different* Job to skip recomputation, the generalization this
"what should be re-executed" question actually needs) as **PROPOSED, not implemented
anywhere**; today's `render --resume` (§3.1) only skips *within* one Job, using its own
already-recorded successful `ExecutionResult`s, not a transitive dependency-invalidation
walk across the DAG triggered by a changed upstream Artifact.

This document marks **actual incremental-rebuild tooling as FUTURE**, consistent with
`EXECUTION_MODEL.md`'s own framing — no audited repo implements dependency-invalidation
propagation across a Plan's DAG today, and inventing that machinery here, under the
"Production State" banner, would smuggle in exactly the kind of new subsystem this
document's central argument (§1) exists to avoid. A Production State query can *report*
that source asset X changed and *report* the DAG edges downstream of it (once
`ARTIFACT_MODEL.md` §3's `derived_from` field exists — itself named there as **FUTURE**,
"not implemented anywhere yet"); it cannot yet *compute* "therefore, re-run steps 4, 7,
and 9" without the incremental-rebuild property `EXECUTION_MODEL.md` names as absent.
That computation, when built, belongs in the Execution layer as a Plan re-validation/
re-compilation step — not bolted onto a Production State read as a side effect.

## 5. Summary

| Element | Status | Where it actually lives |
|---|---|---|
| Intent / Goals / Constraints / Policy / Preferences | UNKNOWN / PROPOSED / CURRENT (mixed — see `INTENT_MODEL.md`) | Project's Intent record |
| Source Assets / Artifacts | CURRENT | `Artifact` records, filtered by `stage` |
| Observations / Decisions | CURRENT | `CORE_PRIMITIVES.md` §5 typed logs |
| Plan / Operations | CURRENT | `ProductionPlan`/`Operation`, `SPEC.md` §3–§4 |
| QC Reports | CURRENT | `QCReport`, `qc-skill`'s existing four-state model |
| "Verification State" (6-state enum) | **REJECTED** | Already covered by `QCReport.overall_status` + `Decision.approval` |
| Delivery State | CURRENT | `Artifact.stage == final/archive` + `DELIVER` Decision |
| Provenance | CURRENT / PROPOSED | Per-Artifact `provenance` + `ProductionReceipt` |
| Consolidated status view | **PROPOSED, new** | A read-only aggregation function/CLI `status` command — §3 |
| "What should be re-executed" | **FUTURE** | Requires `EXECUTION_MODEL.md`'s incremental-rebuild property, not built anywhere |

**The one sentence this document exists to defend:** Production State is what you get
when you ask the existing primitives a question, not a new place to put an answer.
