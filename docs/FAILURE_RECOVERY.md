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
