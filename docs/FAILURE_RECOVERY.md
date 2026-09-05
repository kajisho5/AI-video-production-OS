# Failure, Retry, and Recovery

Status tags as elsewhere in this project: **CURRENT** (verified in `video-production-agent`
or a Skill), **PROPOSED** (generalizes a current pattern into an OS-wide rule, not yet
built), **FUTURE** (named gap, not designed here), **UNKNOWN** (could not be verified,
not fabricated). This document defines failure identity, error categories and their
retryability, the retry policy, rollback semantics, checkpointing, and resumability for
an OS-mediated `ProductionPlan` execution.

## 0. Scope and relationship to `EXECUTION_MODEL.md`

`EXECUTION_MODEL.md` §3 and §5 already specify, as **CURRENT**, real mechanics this
document does not re-derive: `Operation.idempotency_key`, `render --resume last|JOB_ID`,
and the finding that "partial execution" needs no separate checkpoint object because
completed-step Artifacts plus the Job's idempotency-key record already **are** the
checkpoint. This document is the layer on top of that: it names failure *categories* and
their retry/rollback semantics, which `EXECUTION_MODEL.md` explicitly left open (its §4
names `execution/recovery.py`'s exact retry behavior as **UNKNOWN** and does not attempt
a category taxonomy). Where this document restates something from `EXECUTION_MODEL.md`,
it is to build on it, not to re-specify it differently — if the two ever appear to
disagree, `EXECUTION_MODEL.md` is the more directly-verified source per its own §3.2
caveat.

This document is grounded in what already exists in `video-production-agent` and its
Skills, per `REPOSITORY_MAP.md`:

- `execution/recovery.py` implements bounded retry, governed by the hard system
  constraint `execution.recovery.max_attempts=2` from `policy/rules.py`'s
  `SYSTEM_CONSTRAINTS`. This is treated here, as in `EXECUTION_MODEL.md` §4, as a
  **verified, deliberate design choice to preserve**, not a placeholder default this
  document is free to change.
- `Operation.idempotency_key`, used by `render --resume last|JOB_ID` to skip
  already-completed Operations on retry/resume (`CORE_PRIMITIVES.md` §11,
  `EXECUTION_MODEL.md` §3).
- `Artifact.stage` (`working → candidate → approved → final → archive`,
  `ARTIFACT_MODEL.md` §5) — a stage boundary is a naturally-occurring checkpoint, not a
  purpose-built mechanism; an Artifact sitting at `candidate` is real, durable, inspectable
  state, not a special recovery construct.
- `ffmpeg-skill`'s `render.py --keep`/`--work` flags, which retain intermediate stage
  outputs from a multi-step render rather than deleting everything when one internal
  stage fails.
- `qc-skill`'s cache tamper detection: a cache hit is only honored if a stored
  result-hash still matches the recomputed hash of the cached report; a mismatch
  invalidates the entry and forces recompute (`ARTIFACT_MODEL.md` §6,
  `PROVENANCE.md` §1). This is a real, working, narrow failure-recovery mechanism in its
  own right, not a metaphor for one.

## 1. Failure identity: what makes two failures "the same" failure

A **failure**, precisely, is an `ExecutionResult` (`SPEC.md` §4) with
`status: failed | timed_out` for one `Operation`, on one attempt, within one `Job`. Three
distinct scopes matter and must not be conflated:

- **Operation-level failure** — one tool invocation did not complete successfully.
- **Plan-level failure** — the topological walk (`EXECUTION_MODEL.md` §2.2) stopped
  before reaching the end of the DAG, because some Operation's failure exhausted its
  retry budget (§4) or a human interrupted the run.
- **Job-level interruption** — the process running the Plan was killed, timed out, or
  the machine restarted, independent of whether any individual Operation had actually
  failed at that instant. A Job can be interrupted with its current Operation mid-flight
  and no `ExecutionResult` recorded for it at all — this is not the same thing as that
  Operation having failed.

**Identity for retry/resume purposes is the `idempotency_key`** (`EXECUTION_MODEL.md`
§3.2: derived from `{capability_id, provider_id, skill_version, params,
input_artifact_ids}` — the general shape is inferred from documented `--resume` behavior
and from `qc-skill`'s sibling identity pattern, and `EXECUTION_MODEL.md` is explicit that
the *exact* hashed field set was not independently re-derived from source; this document
carries that same **UNKNOWN** forward unchanged rather than fabricating precision).
Two attempts sharing an `idempotency_key` are two attempts at "the same" Operation for
retry-budget purposes (§4). A Decision that authorizes a materially different course of
action (different parameters, a different Provider, a different Capability entirely)
produces a **different** `idempotency_key` and therefore a **new** failure identity with
its own retry budget — this distinction is the mechanical basis for §3's QC-FAIL
boundary below.

## 2. Failure categories and retryability

| Category | Example | Retryable? | Terminal? | Layer | Grounding |
|---|---|---|---|---|---|
| Transient tool failure | subprocess crash, OOM-kill, disk I/O hiccup, non-parameter-caused nonzero exit | Yes, bounded | No | Execution (Operation) | `execution/recovery.py` exists to handle exactly this shape (`REPOSITORY_MAP.md`, `EXECUTION_MODEL.md` §4) |
| Timeout | process-group killed after `timeout_seconds` elapses | Yes, bounded | No | Execution (Operation) | `EXECUTION_MODEL.md` §4 |
| Validation / schema error | a parameter fails the Capability's `input_schema` | No | Yes | Execution (Operation, pre-subprocess) | Deterministic given the same input — retrying an unchanged request rejects identically every time |
| Security rejection | `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` trip, path-containment violation | No | Yes | Execution (Operation, pre-subprocess) | `SKILL_SPEC.md` §3.1: "rejected... never silently stripped" — a reject, not a recoverable failure |
| Missing/ambiguous Capability or Provider | no registered Provider is `AVAILABLE`, or 2+ are and neither an explicit `provider_id` nor a default-provider policy resolves it | No (never reaches Execution) | Yes | Plan compile-time, before any Operation exists | `CAPABILITY_MODEL.md` §Collision policy; `EXECUTION_MODEL.md` §1.1: "compilation fails with a named, actionable error" |
| Contract-version incompatibility | a dependency Skill's `contract_version` is outside the declaring Skill's supported range | No (fails before any attempt) | Yes | Skill startup, before Plan compilation even reaches it | `SKILL_SPEC.md` §6; `ffmpeg-skill`'s `SUPPORTED_MIN`/`SUPPORTED_MAX` pattern (`REPOSITORY_MAP.md`) |
| Cache tamper-detected mismatch | a stored result-hash no longer matches the recomputed hash of a cached report | N/A — not surfaced as a failure at all | N/A | Skill-internal cache layer | Treated as a cache miss, forcing recompute (`ARTIFACT_MODEL.md` §6) — see §8 |
| QC `FAIL` | a `QCReport`'s `overall_status` is `FAIL` | N/A — not a failure category | N/A | N/A — a successful Operation's *content* | See §3 — this is the distinction this document must not conflate |
| Human interruption / Job kill | process killed, machine restarted, Ctrl-C | N/A — Job-level, not a per-Operation failure | No | Job | `render --resume` (`EXECUTION_MODEL.md` §3.1) |
| DEGRADED | preferred Provider unavailable; a lower-quality, permitted alternative Provider exists | Against the *original* preferred Provider, on a later Job re-run (idempotency semantics, §1) | No — proceeds as a new Operation against the alternative Provider | Plan compile-time (Provider re-selection) / Execution (recorded outcome) | See §12; `CAPABILITY_MODEL.md` §Collision policy, §4 below's "no automatic cross-Provider failover" rule |
| OPTIONAL | a Plan step marked `optional: true` (`EXECUTION_MODEL.md` §9) fails or `FAIL`s QC | No — recorded as a warning, not retried automatically unless the Plan is revised | No — the rest of the Plan proceeds | Plan-level aggregation | See §12; `EXECUTION_MODEL.md` §9's worst-wins-over-non-optional-steps rule |

The table's ordering matters: categories 1–2 are the only ones this document treats as
genuinely retryable in the ordinary sense. Categories 3–6 are **terminal on first
occurrence** — retrying them with an unchanged request cannot succeed, because the thing
that made them fail (a bad parameter, a forbidden key, an unresolved Provider, an
incompatible contract) does not change between attempts unless something upstream (a
human, an Agent, a new Skill install) changes it. Whether `execution/recovery.py` already
distinguishes categories 1–2 from 3–6 internally, or applies the same bounded-retry logic
uniformly to any `status: failed` result regardless of cause, is **UNKNOWN** — it was not
independently verified in the audit (`EXECUTION_MODEL.md` §4 carries the same honesty
about this module's internals). §4 below states this document's **PROPOSED** position on
what should happen, explicitly flagged as not-yet-confirmed-as-current-behavior.

## 3. QC `FAIL` is not a failure — restated precisely for recovery purposes

This is the distinction this document is most explicitly instructed not to conflate, and
it is already the ecosystem's own rule, not an invention: `qc-skill`'s ADR-001 states "qc-
skill is not an AI agent and does not make production decisions" (`REPOSITORY_MAP.md`);
`ARCHITECTURE.md` §3 states "a QC `FAIL` is a fact, not an instruction to re-render"; and
`ARTIFACT_MODEL.md` §5 extends the same discipline to the Artifact lifecycle — a QC
`PASS` does not self-promote an Artifact's stage, exactly as a `FAIL` does not
self-trigger anything either.

**The precise mechanical statement for this document:** a QC Operation that *runs to
completion* and returns `overall_status: FAIL` produced a **successful**
`ExecutionResult` (`status: success`) whose *payload* is a `QCReport` carrying a `FAIL`
verdict. It is not an `ExecutionResult` with `status: failed`, and it must never
automatically trigger the retry logic of §2/§4. Retrying an Operation is the correct
response to "this Operation did not complete" — it is never the correct response to "this
Operation completed correctly and reported something nobody wanted to hear."

**What should happen instead, mechanically:** the `QCReport` becomes evidence for an
Inference and a Decision (`CORE_PRIMITIVES.md` §5). If that Decision authorizes another
attempt at producing an acceptable Artifact — e.g. "re-render with a lower gain to avoid
the clipping this QC check found" — the result is a **new** `ProductionStep` /
`Operation` with **different effective parameters**, and therefore a **different
`idempotency_key`** (§1). This is Plan-level replanning, authorized by a human- or
Agent-made Decision with its own recorded evidence and basis — never an Execution-level
retry of the same Operation. The two are mechanically distinguishable by exactly one
question: did the `idempotency_key` change? If yes, it is a new Operation authorized by a
new Decision. If no, it would be an automatic retry of an Operation that already
succeeded and reported a verdict — which this document, following the ecosystem's own
existing rule, says must never happen.

**The one case where a QC Operation genuinely IS an ordinary failure:** if the QC tool
itself crashes, times out, or otherwise never produces a `QCReport` at all, that is an
ordinary Operation-level failure under §2's transient/timeout categories, retryable under
the normal bounded policy (§4) exactly like any other Operation. The distinguishing
question is simple and load-bearing: **did the QC tool run and report a verdict, or did
it fail to run at all?** The former is data for a Decision; the latter is an
infrastructure failure like any other.

## 4. Retry policy

**CURRENT, verified constraint:** `execution.recovery.max_attempts=2`
(`SYSTEM_CONSTRAINTS`, `policy/rules.py`, per `REPOSITORY_MAP.md` and
`EXECUTION_MODEL.md` §4). This document treats `max_attempts=2` the same way
`EXECUTION_MODEL.md` does: as a verified, deliberate system constraint to preserve, not a
default this document is free to raise, lower, or make configurable. No evidence was
gathered anywhere in the audit for *why* 2 specifically, and none is fabricated here — it
is documented as a fact about the existing system, not justified from first principles.

**What "an attempt" is, precisely (§1):** one subprocess invocation of a given
`idempotency_key`. `max_attempts=2` bounds how many times the Execution layer will invoke
the *same* Operation (same capability, provider, skill version, params, input artifacts)
before giving up and surfacing the failure upward (to a Job-level stop, per
`EXECUTION_MODEL.md` §5.1's "partial execution" definition).

**What is UNKNOWN and stays UNKNOWN, carried forward unchanged from
`EXECUTION_MODEL.md` §4:** whether the second attempt is a plain re-invocation, uses a
backoff delay, or mutates any parameter between attempt 1 and attempt 2 was not verified
in the audit at sufficient depth to describe further. This document does not fabricate
that detail.

**PROPOSED refinement — category-aware retry budget (not confirmed as current
behavior):** per §2's terminal categories, retrying a validation error, a security
rejection, a missing/ambiguous Provider, or a contract-version incompatibility with an
unchanged request cannot succeed. This document proposes that such categories should
**not** consume the `max_attempts=2` budget at all — they should surface immediately as
an actionable error on first occurrence, since spending a retry on a deterministic
rejection wastes the bounded budget on a category of failure retrying can never fix, and
(worse) could mean a *transient* failure on the eventual second attempt has no budget
left. Whether `execution/recovery.py` already implements this distinction internally is
**UNKNOWN** — not claimed as already true, named here as the correct target behavior.

**No automatic cross-Provider failover.** Per `CAPABILITY_MODEL.md`'s collision policy,
Provider selection happens once, at Plan-compile time, and is recorded on the `Operation`
and later the `ProductionReceipt` (`EXECUTION_MODEL.md` §1.1). If an Operation against a
chosen Provider exhausts its retry budget, the Execution layer must **not** silently
substitute a different Provider of the same Capability (e.g. falling back from
`qc-skill`'s loudness measurement to `media-analysis-skill`'s) — that would be an
unprovenanced, undocumented substitution of exactly the kind the collision policy exists
to prevent. A genuinely failed Provider surfaces as a failed Operation for a human or
Agent to replan against, explicitly, with a different `provider_id` — which, per §3's
mechanical rule, is a new Operation with a new `idempotency_key`, not a retry.

## 5. Rollback: what state rolls back vs. persists

**Central finding, following directly from `EXECUTION_MODEL.md` §1.2 and §5.2:** because
an Artifact is only durably written when an Operation *succeeds*, a failed Operation
produces **no Artifact at all**, by construction. There is nothing to roll back at the
Artifact layer — a failed attempt simply leaves no trace in the Artifact graph, and its
`idempotency_key` has no successful `ExecutionResult` recorded, so a subsequent retry or
`render --resume` will (re-)attempt it exactly as if it had never run.

**What persists, unconditionally:** every Artifact already produced by a completed
upstream step — the "prefix" of the Plan's topological walk that finished before the
failure (`EXECUTION_MODEL.md` §5.1) — is untouched by a downstream failure. This is
**the** checkpoint; no separate rollback mechanism is needed, because forward-only
Artifact production plus idempotency-keyed resume already gives "continue from where you
left off" for free. There is no half-written Artifact state to unwind, because each
Operation is a complete, self-contained subprocess lifecycle with no shared in-process
state that could be left dangling (`EXECUTION_MODEL.md` §1.2).

**Stage is itself checkpoint granularity, not just an approval workflow.** An Artifact
sitting at `candidate` (`ARTIFACT_MODEL.md` §5) is a real, meaningful, durable checkpoint:
it has already been through at least one verification pass. If a later, independent step
in the Plan subsequently fails, that `candidate` Artifact is not undone, re-derived, or
reset to `working` — promotion is monotonic and Agent/human-driven only
(`ARTIFACT_MODEL.md` §5's "stage transitions are not self-reported" rule), and a failure
elsewhere in the DAG has no mechanism by which it *could* demote a stage, any more than a
success elsewhere could self-promote one.

**Two distinct checkpoint granularities exist, and they must not be conflated:**

1. **Inter-Operation (Plan/Job level, OS-owned).** The Job's record of which
   `idempotency_key`s already have a successful `ExecutionResult`
   (`EXECUTION_MODEL.md` §3.1) — this is what `render --resume` reads, and it is the
   granularity everything above in this section describes.
2. **Intra-Operation (Skill-owned, finer-grained).** A single Operation can itself be a
   multi-stage process inside one Skill's own implementation. `ffmpeg-skill`'s
   `render.py --keep`/`--work` flags are the concrete, existing example: they retain
   intermediate stage outputs from a multi-step render rather than deleting everything if
   a later internal stage fails. This is a **Skill's own internal responsibility**, per
   the Runtime/Skill boundary (`CORE_PRIMITIVES.md` §4) — the OS Execution layer does not
   need to know about, manage, or expose a Skill's internal staging; it only ever
   observes that one Operation's final `success`/`failed`/`timed_out` status and the
   Artifact(s) that Operation declares as output. Whether a Skill chooses to retain or
   discard its own intermediate stages on internal failure is an implementation detail of
   that Skill, not an OS-level contract requirement today. **FUTURE:** whether
   `retains_intermediate_outputs` should become a declared field on the
   `CapabilityContract` (`SPEC.md` §1) — so an Agent could know, without reading a
   Skill's docs, whether a partially-failed multi-stage Operation left anything
   inspectable behind — is an open question, not designed here.

**What is explicitly NOT proposed:** no compensating-transaction/saga framework, no
automatic multi-Operation rollback, no "undo" of an already-produced `approved` Artifact
triggered by a later step's failure. No audited repo's failure mode is ever "unwind prior
successful work automatically" — it is uniformly "stop, and let resume or replanning
happen." Building a rollback engine here would be exactly the kind of un-evidenced
infrastructure `ARCHITECTURE.md` §9 (lens 5) and §10 already rule out for scheduling and
concurrency; the same discipline applies here.

## 6. Checkpointing (pointer, not re-derivation)

Fully specified in `EXECUTION_MODEL.md` §5: "partial execution" is simply some prefix of
the Plan's steps having completed and produced Artifacts before the walk stopped, and the
set of already-produced Artifacts plus the Job's idempotency-key record together **are**
the checkpoint — no separate checkpoint object exists or is proposed. This document's one
addition: a checkpoint, read via an Artifact's `stage`, carries not just "did this step
finish" but "how far through the intended verification path did it get" — an Artifact at
`candidate` with an attached `QCReport` (whatever its `overall_status`) tells a resuming
Agent more than an Artifact at `working` would, for free, without any new mechanism (per
§3, a `FAIL` verdict recorded there is exactly as durable and exactly as non-blocking to
resume as a `PASS` would be — the checkpoint doesn't care which verdict it got, only that
a QC Operation completed).

## 7. Resumability

`render --resume last|JOB_ID` resumes a **Job** — a whole Plan-execution run — by
re-walking the DAG (`EXECUTION_MODEL.md` §2.2, §3.1) and skipping any step whose
`idempotency_key` already has a recorded successful `ExecutionResult`.

**Retry vs. resume, precisely distinguished, since the two are easy to conflate:**

- **Retry** (§4) happens automatically, *within* a single Job's single pass through a
  step, without the Job process necessarily exiting — the Execution layer re-invokes the
  same Operation up to `max_attempts=2` times before giving up on that step for this pass.
- **Resume** happens by re-invoking the CLI *after* a Job has stopped (retries exhausted,
  human-killed, machine restarted) to continue the walk from the last successful
  checkpoint (§6).

**UNKNOWN, named here rather than assumed either way:** whether a resumed Job's
re-attempt at a still-failing step gets a *fresh* `max_attempts=2` budget, or whether
attempt counts persist across a resume so a step that already exhausted its budget once
does not get retried again automatically on resume (requiring, instead, an explicit new
Decision per §3's mechanics). This was not verified in the audit and is not fabricated
here; it is a candidate for direct source citation in a future revision of this document.

## 8. `qc-skill`'s cache tamper detection as a small, distinct failure-recovery mechanism

Per `ARTIFACT_MODEL.md` §6 and `PROVENANCE.md` §1: a cache hit is only honored if a
stored result-hash still matches the recomputed hash of the cached report; a mismatch
invalidates the entry and forces recompute, exactly as if no cache entry had existed.

This is worth naming explicitly as a **third, distinct failure mode**, alongside "an
Operation didn't complete" (§2) and "a Provider was ambiguous" (§4's collision
discussion): **previously-trusted state turned out to be untrustworthy** — corrupted,
tampered, or simply stale in a way its own identity check can detect. The recovery action
is uniform, silent, and requires no Decision, no retry budget, and no human involvement,
precisely *because* unlike a QC `FAIL` (§3) there is no judgment call involved — only "is
this data what it claims to be," answered by recomputing the same hash and comparing.
This is a materially simpler kind of recovery than either retry (§4, which addresses
non-determinism/transience in execution) or replanning (§3, which requires human/Agent
judgment) — it addresses neither; it addresses a stored artifact silently failing to be
what its own identity says it is.

**PROPOSED generalization:** per `ARTIFACT_MODEL.md` §6's own proposed generalization
(any OS-level cache keyed by provenance identity, including the cross-Job Operation-cache
reuse `EXECUTION_MODEL.md` §3.3 names as PROPOSED), this document adds: tamper
re-verification on every read, not merely on write, should be a standing failure-recovery
requirement for any cache this OS ever formalizes — not an optional nicety `qc-skill`
happened to build for its own reasons. A cache that trusts its own filesystem state
unconditionally is one disk corruption or manual edit away from silently serving a wrong
result, which is a strictly worse failure mode than a cache miss (a miss costs time; an
undetected tamper costs correctness).

## 9. Summary table

| Category | Retryable | Terminal | Counts vs. `max_attempts=2` | Rolls back an Artifact? |
|---|---|---|---|---|
| Transient tool failure | Yes | No | Yes (CURRENT) | No — none was produced |
| Timeout | Yes | No | Yes (CURRENT) | No — none was produced |
| Validation/schema error | No | Yes | Should not (PROPOSED) | No — none was produced |
| Security rejection | No | Yes | Should not (PROPOSED) | No — none was produced |
| Missing/ambiguous Provider | No — never reaches Execution | Yes | N/A (compile-time) | N/A |
| Contract-version incompatibility | No — never reaches Execution | Yes | N/A (startup-time) | N/A |
| Cache tamper mismatch | N/A — self-healing recompute | N/A | N/A | N/A — not a caller-visible failure |
| QC `FAIL` | N/A — not a failure | N/A | N/A | No — a successful Operation's payload |
| Human interruption / Job kill | N/A — resume, not retry | No | Resets per §7 (UNKNOWN whether counter persists) | No — completed prefix persists |
| DEGRADED | Against original preferred Provider, on later Job re-run | No | New `idempotency_key` — does not count against the failed attempt's budget | No — the degraded-path Artifact is a new Operation's normal output |
| OPTIONAL | No — automatic retry only via explicit Plan revision | No | N/A — not an Execution-layer retry at all | No — no Artifact was expected to roll back; rest of Plan is unaffected |

## 10. What this document deliberately does not add

- No distributed saga or compensating-transaction engine (§5).
- No automatic cross-Provider failover on Operation failure (§4).
- No new checkpoint artifact type beyond what `ARTIFACT_MODEL.md` and
  `EXECUTION_MODEL.md` already establish (§6).
- No claim that category-aware retry-budget short-circuiting (§4) is already implemented
  — it is PROPOSED, because `execution/recovery.py`'s internals were not independently
  verified in the audit, and this document does not fabricate that verification.
- No new resource/concurrency model to support "faster" recovery through parallel retry —
  per `EXECUTION_MODEL.md` §0/§2.2, execution is strictly sequential, and nothing in this
  document proposes otherwise.

## 11. Open questions / UNKNOWNs carried forward

- The exact field set hashed into `idempotency_key` (`EXECUTION_MODEL.md` §3.2) — UNKNOWN,
  unchanged here.
- Backoff and/or parameter-mutation behavior of `execution/recovery.py` between attempt 1
  and attempt 2 (`EXECUTION_MODEL.md` §4) — UNKNOWN, unchanged here.
- Whether `execution/recovery.py` already distinguishes terminal from retryable
  categories (§2/§4), or applies bounded retry uniformly regardless of failure cause —
  UNKNOWN, new to this document.
- Whether a resumed Job's attempt counter for a given `idempotency_key` resets or persists
  across the resume boundary (§7) — UNKNOWN, new to this document.
- Whether a Plan that stops partway through (not merely one that finishes with QC
  failures) should emit a partial `ProductionReceipt` — named as an open question in
  `PROVENANCE.md` §4, not re-answered here.

## 12. DEGRADED and OPTIONAL: two additional categories, from a stakeholder review

Two more outcome categories, surfaced in a stakeholder review, extend the taxonomy above
without changing the retryable/terminal split already established in §2/§4: **DEGRADED**
and **OPTIONAL**. Neither is a new *failure* in the sense §1 defines one (an
`ExecutionResult` with `status: failed | timed_out`) — both describe how the OS should
report and route an outcome that is not a clean success but is also not the kind of stop
this document's terminal categories describe. They are named here as a distinct pair
because a stakeholder review specifically flagged the risk of collapsing them into each
other, or into an ordinary FAIL, and this document treats that as a real finding worth a
named section, not folded silently into §2's table.

### 12.1 DEGRADED — an acceptable fallback Provider, chosen explicitly and provenanced

**Definition.** DEGRADED describes the situation where a preferred Provider or Capability
path is unavailable (missing, `AVAILABLE` state lost, or itself exhausted its retry
budget per §4), but a lower-quality-but-still-acceptable alternative Provider of the same
Capability exists **and is permitted**. Concretely, the two-Provider
`measure.audio.loudness` situation `CAPABILITY_MODEL.md` already documents
(`qc-skill` and `media-analysis-skill` as independent Providers) is the shape: if the
preferred Provider is unavailable and the Plan (or a resolvable default-provider policy)
permits the other one, proceeding against it is a DEGRADED outcome, not a FAIL.

**This is not silent runtime fallback — it is exactly the mechanism §4 above already
describes, named.** §4's "No automatic cross-Provider failover" rule already establishes
that Provider substitution is never silent: "a genuinely failed Provider surfaces as a
failed Operation for a human or Agent to replan against, explicitly, with a different
`provider_id`... a new Operation with a new `idempotency_key`, not a retry." DEGRADED is
the name for exactly that replanned outcome, when the newly-chosen Provider is understood
to be a lower-quality alternative rather than an equivalent one. It requires the same
explicit re-selection `CAPABILITY_MODEL.md`'s collision policy already mandates for any
multi-Provider Capability — DEGRADED does not relax that policy, it is one named outcome
of applying it after a failure.

**The constraint a parallel review made explicit, and this document adopts without
restating its exact wording: a degraded fallback must never silently violate an
Intent-level Hard Constraint or Permission.** `PRINCIPLES.md` §4 already establishes that
a Hard Constraint is not something an Agent's preferences — or, by direct extension, an
Agent's *fallback* choices — may relax: "a preference can be overridden or traded off, a
constraint cannot." `INTENT_MODEL.md` §2 and §6 name the two concrete shapes this
protects here: a Hard Constraint ("deliver as .mp4," "duration <= 60s") and a Permission
("local rendering allowed," `INTENT_MODEL.md` §6 — a Runtime-boundary-scoped
authorization, not yet enforced machinery anywhere in the ecosystem today, but named as
the exact slot this rule references). Concretely, per `INTENT_MODEL.md` §6's own worked
example: **falling back from a local Provider to a hypothetical cloud Provider when
"local-only" was a stated constraint is not a valid DEGRADED path — it is FATAL**, because
it would silently change *what was promised* (a local-only guarantee), not merely *how
well* the Capability was accomplished. The distinguishing test is exactly this: does the
alternative Provider still satisfy every Hard Constraint and Permission the original
choice did, and differ only in quality/preference-shaped terms (resolution ceiling,
measurement precision, latency)? If yes, DEGRADED. If the alternative would violate a Hard
Constraint or exceed a Permission's scope to reach, it is not a permitted alternative at
all — the Operation must surface as a terminal failure (§2's "missing/ambiguous
Capability or Provider" category, or a new named FATAL case if none of the registered,
*permitted* Providers can satisfy the Plan) for a human or Agent to resolve, never a
silent substitution.

**Recording is mandatory, never silent.** Per `PROVENANCE.md` §2's required field list
("Capability id + Provider id... Two Providers of `measure.audio.loudness` are not
interchangeable for reproducibility purposes"), a DEGRADED outcome's actual `provider_id`
is already a required provenance field for the resulting Artifact and, at the Plan level,
belongs in the `ProductionReceipt`'s `warnings` (`SPEC.md` §6) — a DEGRADED path is not
merely permitted to be recorded, it is a `warnings`-worthy fact by the same logic a QC
`WARN` is: something acceptable happened, but not the originally-preferred thing, and a
human or downstream Agent reviewing the Receipt should be able to see that without
re-deriving it from the raw Operation log.

**Interaction with retry policy.** A DEGRADED outcome does not retry the failed preferred
Provider automatically — per §4's mechanical rule, that would require a new Decision and
therefore a new `idempotency_key`, exactly like any other replanned Provider choice. What
DEGRADED specifically permits, consistent with idempotency semantics already established
in §1 and `EXECUTION_MODEL.md` §3.2: on a **later** Job re-run (a fresh `render --resume`
or a fresh Plan execution against the same inputs), the Execution layer may retry against
the **original** preferred Provider again — its own `idempotency_key` is unchanged from
before, so if it is `AVAILABLE` again on the later run, nothing prevents the ordinary
compile-time resolution (`EXECUTION_MODEL.md` §1.1) from choosing it as it would have the
first time. DEGRADED is a per-run outcome, not a permanent demotion of the preferred
Provider.

### 12.2 OPTIONAL — a Plan step's failure that does not gate the rest of the Plan

**Definition.** OPTIONAL describes an Operation's failure (or a `QCReport`'s `FAIL`
verdict, per §3's distinction) on a `ProductionPlan` step explicitly marked
`optional: true` — the field `EXECUTION_MODEL.md` §9 proposes on `SPEC.md` §3's
`steps[]`, e.g. thumbnail generation failing while video/audio/subtitle delivery from the
same Plan is unaffected. Per `EXECUTION_MODEL.md` §9's worst-wins-over-non-optional-steps
aggregation rule, an OPTIONAL step's failed or `FAIL`-verdicted Artifact does not drag the
Plan's aggregate status down — it is recorded and the walk continues.

**OPTIONAL is not DEGRADED.** No fallback occurs — there is no alternative Provider being
substituted in, no Operation runs in the failed step's place, and no Artifact of that
logical role is produced at all. The optional output is simply absent from the Plan's
final result set, and that absence is itself the recorded fact.

**OPTIONAL is not a terminal FATAL failure either.** The rest of the Plan proceeds exactly
as if the optional step's dependents (if any — an optional step with dependents is a Plan
design choice worth Agent-side scrutiny, not something this document forbids) were
satisfied by absence rather than by a produced Artifact. This is deliberately a third
outcome distinct from both ends of §2's retryable/terminal spectrum: not "retry and maybe
succeed," not "stop the Plan," but "note it, and keep going."

**Interaction with retry policy.** An OPTIONAL step's failure is recorded as a warning
(`ProductionReceipt.warnings`, `SPEC.md` §6) — it is **not retried automatically**, at all,
regardless of whether the underlying failure category would ordinarily be retryable under
§2/§4 (a transient tool crash on an optional thumbnail render does not consume any of the
Plan's attention the way the same crash on a non-optional step would). The only path back
to attempting that output is an **explicit Plan revision** — a human or Agent adding a new
step (a new Decision, a new `idempotency_key`, per §3's mechanics) that tries again,
exactly as any other re-attempt after a terminal or exhausted-retry-budget outcome would
require. This keeps OPTIONAL's failure mode symmetric with the rest of this document's
central rule: nothing retries itself without an explicit authorizing Decision, and marking
a step optional changes *whether its absence blocks the Plan*, not *whether failures are
free to retry themselves silently*.

### 12.3 Where these fit in this document's existing structure

Both categories have been added as rows to §2's and §9's tables above; §1's
failure-identity rules (Operation/Plan/Job scope, `idempotency_key` as retry-identity) and
§5's rollback rules (a failed attempt produces no Artifact, so there is nothing to roll
back) apply to DEGRADED and OPTIONAL exactly as written — neither introduces a new
rollback or checkpoint mechanism, consistent with §10's list of what this document
declines to add.

## 13. Error taxonomy by SOURCE — a second, complementary axis

Everything in §2/§9/§12 above classifies a failure by **SEVERITY**: what should happen
next (retry, stop, degrade, ignore). This section adds a distinct **SOURCE** taxonomy:
*where did the error originate*. These are two different axes over the same failure, not
competing classification systems — a single `ExecutionResult` failure has exactly one
SEVERITY (from §2's table) and exactly one SOURCE (from the list below), and the two
questions are answered independently. Nothing in §1–§12 is revised by this section; it is
purely an additional, orthogonal dimension named against the same evidence base.

### 13.1 The eight SOURCEs

| SOURCE | What it means | Grounding | Possible SEVERITY categories (§2) |
|---|---|---|---|
| **Contract error** | The request does not match the Capability Contract's own declared schema (a parameter fails `input_schema`, an unexpected key is present). | The real, existing precedent is per-Skill schema validation — concretely, the `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` rejection already in §2's table ("a parameter fails the Capability's `input_schema`... `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` trip"), `SKILL_SPEC.md` §3.1's "rejected... never silently stripped" rule, and `SECURITY_MODEL.md` §1.1's denylist enforced independently across at least seven repos. | **Always terminal, never retryable** (§2's "Validation / schema error" row). Retrying the same malformed request against the same schema rejects identically every time — nothing about a Contract error changes between attempts unless a human or Agent revises the request itself. |
| **Capability error** | The requested Capability id does not exist in the registry at all — distinct from a Contract error (the id is valid but the *parameters* are wrong) or a Provider error (the id resolves but the chosen implementation fails). | `CAPABILITY_MODEL.md`'s registry model (a Capability is "a named, typed, versioned unit... independent of which Skill implements it," `CORE_PRIMITIVES.md` §1) and `EXECUTION_MODEL.md` §1.1's compile-time resolution step, which fails before any Operation exists if the id cannot be resolved at all. | **Always terminal**, and — like the existing "Missing/ambiguous Capability or Provider" row in §2 — **never reaches Execution**; it is a Plan compile-time failure, not an Operation-level one. Retrying does nothing without a registry change (a new Skill installed, a typo fixed). |
| **Permission error** | A Hard-Constraint or Permission violation — a fallback or Provider choice that would exceed what the Project's Intent authorized (e.g. a network-requiring fallback blocked because "local-only" was a stated constraint). | `INTENT_MODEL.md` §6's Permission concept (a Runtime-boundary-scoped authorization, today **FUTURE** with no live use case, since `SPEC.md` §7 confirms no Skill uses network access anywhere) and §12.1 above's own worked example: "falling back from a local Provider to a hypothetical cloud Provider when 'local-only' was a stated constraint is not a valid DEGRADED path — it is FATAL." | **Always terminal.** A Permission error is definitionally about what is *authorized*, not about transient execution state — retrying the same request against the same unauthorized reach cannot succeed; only an explicit new Permission grant (a human/Agent decision, not a retry) changes the outcome. Today this SOURCE is **entirely forward-looking**: since no Provider anywhere in the ecosystem is network-based, no Permission error has ever actually occurred — it is named now, per §12.1's own reasoning, "precisely because... permission boundaries need to exist before that first cloud Provider does, not be retrofitted afterward." |
| **Security error** | A `PathPolicy` violation (symlink-based containment escape, write outside the declared workspace root) or a forbidden key detected in a parameter tree. | `SECURITY_MODEL.md` §1's existing enforcement, items 1–2: the `FORBIDDEN_KEYS` denylist and symlink-resolved `PathPolicy` containment, "independently reinvented in at least seven of the eleven audited repositories." This is distinct from a Contract error even though both can trip on the same `FORBIDDEN_KEYS` check: a Contract error is "this parameter shape is not what the schema allows," while a Security error is "this specific value is a recognized attack shape" (a path-traversal payload, a `command`/`shell` key) — the same mechanical check, but the distinction matters for how the rejection should be *reported* (§13.3 below) and audited. | **Always terminal**, exactly like Contract errors, and for the identical reason: `SECURITY_MODEL.md`'s denylist is deterministic — the same forbidden key or containment escape is rejected identically on every attempt. A Security error must never be silently stripped and retried; per `SKILL_SPEC.md` §3.1, it is rejected outright. |
| **Provider error** | The chosen Provider itself failed to execute correctly — a subprocess crash, an OOM-kill, a non-parameter-caused nonzero exit, a timeout. This is what the large majority of this document's existing content (§1–§12) already covers. | `execution/recovery.py`'s bounded-retry handling of exactly this shape (§2's "Transient tool failure" and "Timeout" rows; `REPOSITORY_MAP.md`, `EXECUTION_MODEL.md` §4). | **Retryable, bounded** (§4's `max_attempts=2`) in the ordinary case; **DEGRADED-eligible** per the existing fallback policy (§12.1) if the retry budget is exhausted and a permitted, Intent-respecting alternative Provider exists; otherwise surfaces as a terminal failure for replanning (§4's "No automatic cross-Provider failover" rule). A Provider error is the one SOURCE in this table that spans the widest range of possible SEVERITY outcomes, which is exactly why §1–§12 needed this much space to specify it fully. |
| **Runtime error** | A process-level failure distinct from the Provider's own logic failing: a timeout enforced at the subprocess boundary, a crash of the subprocess itself, resource exhaustion (memory, disk) that the Runtime — not the Skill — observes. | `EXECUTION_MODEL.md` §8's consolidated Runtime responsibilities table: "Isolation," "Timeout," and "Resource Control" rows, plus `SECURITY_MODEL.md` §5's honest gap (only a wall-clock timeout is enforced anywhere; no CPU/memory/disk limits exist in any audited Skill). A Runtime error and a Provider error can look identical from outside (both surface as `status: failed | timed_out`) — the distinction is *whose* fault the failure was: the Runtime killing a process-group on `timeout_seconds` elapsing is a Runtime error even if the underlying Provider would have eventually succeeded; a Provider crashing on its own before any Runtime-imposed limit is reached is a Provider error. This distinction is useful for the error-presentation convention in §13.3 below (a human debugging "why did this fail" benefits from knowing whether the Runtime cut it off or the Provider gave up on its own) even though both currently share one `ExecutionResult.status` value. | **Typically retryable** — §2's "Timeout" row is explicitly bounded-retryable, and a resource-exhaustion kill is mechanically identical to a transient tool failure for retry purposes (nothing about the request itself was wrong, so a retry may succeed if the transient condition clears). Not terminal by default, unlike Contract/Capability/Permission/Security errors above. |
| **QC/Verification error** | **Not a failure in the execution sense at all — included here only to state explicitly that it is a different SOURCE than a Runtime error, never to imply the two are equivalent.** A `QCReport.overall_status: FAIL` is the *payload* of a successful `ExecutionResult`, not an error. | `QC_ARCHITECTURE.md` §3's existing, code-enforced position: "qc-skill is not an AI agent and does not make production decisions"; a `QCReport.overall_status = FAIL` is "a fact about measured reality against a stated threshold," never itself a system failure — this document's own §3 already states the identical rule ("a QC `FAIL` is not a failure... It is not an `ExecutionResult` with `status: failed`"). | **N/A for SEVERITY** — this row exists in the SOURCE taxonomy purely so that a reader classifying an outcome by source does not reach for "Runtime error" or "Provider error" merely because a QC check reported something unwelcome. The one genuine exception, already stated in §3: if the QC *tool itself* crashes or times out without producing a `QCReport` at all, that specific failure is a Runtime or Provider error like any other (whichever applies) — the SOURCE is never "QC/Verification error" in that case, because nothing about QC's own judgment was involved; the QC tool simply didn't run. |
| **External-service error** | A network/API failure — a timeout or error response from a remote service a Provider depends on. | **Entirely hypothetical today.** Per `SPEC.md` §7 and `REPOSITORY_MAP.md`, no Skill in the ecosystem uses network access anywhere; every Provider is a local subprocess against a local binary. This SOURCE is named now for the same forward-looking reason `INTENT_MODEL.md` §6 names Permissions now: "the day a Skill needs network access... there should already be a place in the [taxonomy] for" the failure mode that comes with it, rather than inventing one ad hoc at that point. | **Entirely FUTURE** — no SEVERITY mapping is proposed because no such error has ever actually occurred in the audited ecosystem to observe a mapping from. A plausible future shape (network timeout → retryable; API auth failure → terminal, closer to a Permission error) is deliberately not specified here, to avoid fabricating detail about a mechanism that does not exist. |

### 13.2 Why SOURCE and SEVERITY must stay two axes, not one

Collapsing them would lose information both ways: two errors with the same SEVERITY
(both terminal, say) can have completely different SOURCEs requiring different fixes — a
Contract error is fixed by correcting the request's parameters; a Capability error is
fixed by installing or registering the missing Skill; a Permission error is fixed by an
explicit new grant. Conversely, two errors with the same SOURCE can have different
SEVERITY depending on circumstance — a Provider error is sometimes retryable (a transient
crash) and sometimes not (the Provider's retry budget is exhausted and no permitted
fallback exists, per §4/§12.1). Neither axis substitutes for the other; §2's table answers
"what should the Execution layer do next," and this section's table answers "what part of
the system is actually responsible," and a complete error record needs both, exactly as
`SPEC.md` §4's `ExecutionResult` already carries `status`/`retryable` (SEVERITY-shaped)
independently of `tool_output` (which is where SOURCE-relevant detail — which Provider,
which check, which parameter — already lives verbatim).

### 13.3 Internal error detail vs. user-facing error message (PROPOSED presentation convention, not a new data structure)

**This is a formatting convention, not a schema change.** `SPEC.md`'s existing
`ExecutionResult` (`status`, `outputs`, `tool_output`, `duration_ms`, `retryable`) already
carries enough information for everything below — this section proposes no new field
anywhere in `SPEC.md`, `ARTIFACT_MODEL.md`, or this document. What it proposes is a
convention for how that existing information gets **presented** to a human or an Agent
consuming a failure, rather than handing over a raw stack trace or an unfiltered
`tool_output` blob as the only interface.

**The precedent this generalizes is already real, not invented for this section.**
`video-production-agent`'s own `tools/skill_process.py` implements a function named
exactly `scrub(obj, forbidden)`, whose docstring reads: *"Error details the Skill
returned, minus anything that looks like a command or credential (recorded for humans
only)."* It strips any key matching the `FORBIDDEN_KEYS`-shaped denylist out of a Skill's
error payload before that payload is recorded — the same discipline `SECURITY_MODEL.md`
§1 already documents for ordinary request parameters, applied a second time to error
*output*. This section proposes the same discipline, one step further: not just
*sanitizing* error detail (already real, per `scrub()`), but *structuring its
presentation* so a consumer isn't left parsing a sanitized-but-still-raw blob to answer
basic questions.

**The proposed presentation convention.** An error surfaced to a human or an Agent should
answer, in a fixed, scannable shape:

1. **What failed** — the Operation/Capability/step in plain terms, not merely an id.
2. **Where** (which SOURCE, §13.1) — a Contract error and a Provider error call for
   completely different next actions, and a consumer should not have to reverse-engineer
   which one occurred from an unstructured message.
3. **Why, in plain terms** — the sanitized (`scrub()`-style) detail already available in
   `ExecutionResult.tool_output`, summarized rather than dumped verbatim.
4. **Whether it's retryable** — `ExecutionResult.retryable` (`SPEC.md` §4) already carries
   exactly this fact; the presentation convention's only job is to surface it prominently
   rather than requiring the consumer to know to look for that field.
5. **What's affected** — which downstream Artifacts/steps, if any, are blocked as a
   result (per `EXECUTION_MODEL.md` §9's Plan-level aggregation — an optional step's
   failure affects less than a non-optional one, and a presentation that doesn't say so
   forces the consumer to re-derive it).

**Status: PROPOSED/FUTURE.** No repository in the audited ecosystem documents a formal
error-presentation convention today — this is named as a gap, not claimed as existing
practice. It is, however, a **low-risk formalization rather than a speculative one**:
several of the audited CLIs already do something reasonable in this direction on their
own initiative (structured `--json` error output, the `scrub()` sanitization pattern
above) without it being written down anywhere as a cross-ecosystem convention. This
section's contribution is naming that convention explicitly, once, using fields
(`ExecutionResult.status`/`retryable`/`tool_output`, plus this section's new SOURCE
taxonomy) that already exist — not inventing new machinery to produce it.
