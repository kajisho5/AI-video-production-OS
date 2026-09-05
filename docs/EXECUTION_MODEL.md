# Execution Model: ProductionPlan → Execution

This document specifies how an approved `ProductionPlan` (`SPEC.md` §3) becomes running
processes, artifacts, and provenance. As with every other document in this set, it
separates **CURRENT** (verified by reading `video-production-agent`'s code, per
`REPOSITORY_MAP.md`) from **PROPOSED** (generalized so a third-party Skill or a different
Agent can plug into the same contract). Where the temptation is to add something no
audited repo needs — a scheduler, a concurrency model, a distributed job queue — this
document says so explicitly and declines, per `ARCHITECTURE.md` §8/§10.

## 0. Scope and non-goals

This is the **Execution/Runtime** layer named in `CORE_PRIMITIVES.md` §4 and listed in
the kernel in `ARCHITECTURE.md` §8 item 5: "the safe-invocation guarantees... and the
Operation/Execution/idempotency-key model." It sits between a validated `ProductionPlan`
and the Skills that actually do work.

**Explicitly out of scope, per direct instruction and per evidence:**

- **No scheduler or concurrency model.** `REPOSITORY_MAP.md` confirms "no evidence
  anywhere in the ecosystem shows a need for one" (`CORE_PRIMITIVES.md` §11, Resource) —
  every audited repo runs one Operation at a time, in-process, from a single CLI
  invocation. This document does not invent parallel execution, worker pools, or a task
  queue. If that need appears later, it is Roadmap work with its own evidence, not
  something backfilled here speculatively.
- **No distributed execution.** Every Operation today runs as a local subprocess on the
  same machine as the Agent. Nothing in this document assumes otherwise.
- **No new DAG engine.** Per `ARCHITECTURE.md` §6, the Plan's `steps`/`depends_on`
  structure (`SPEC.md` §3) already **is** the DAG. Execution walks that existing
  structure; it does not introduce a second graph representation.

## 1. The pipeline this layer covers

Restating the pipeline named in `REPOSITORY_MAP.md`'s `video-production-agent` entry, this
document owns the right-hand half of it:

```
... ProductionPlan → [ Compiler → Operation → Executor(ToolRouter) → Artifact ] → QA ...
```

### 1.1 Compiler: Plan → Operation (CURRENT)

`execution/compiler.py` walks each `ProductionStep` in an approved `ProductionPlan` and
produces one or more `Operation`s (`SPEC.md` §4). This is where a step's abstract
capability reference becomes one deterministic, typed tool invocation — never a raw
shell command or filter string (`FORBIDDEN_KEYS` boundary, `ARCHITECTURE.md` §7).
Concretely, per `REPOSITORY_MAP.md`, compilation today resolves a step to a candidate
tool id via `SkillRegistry` (e.g. abstract capability `silence_cleanup` → ordered
candidate list `["ffmpeg-skill/cut", "video-editing/cut"]`) and picks the first
`AVAILABLE` one.

**PROPOSED refinement (per `CAPABILITY_MODEL.md` §Collision policy):** compilation should
resolve `capability_id` + `provider_id` **before** producing the `Operation`, not pick the
first available candidate silently. Concretely:

1. If the `ProductionStep` names an explicit `provider_id`, the Compiler uses it — this is
   already directly expressible in `SPEC.md`'s `steps[].provider_id` field.
2. If not, the Compiler consults a default-provider policy (Workspace- or OS-level; see
   `CAPABILITY_MODEL.md` §Collision policy, mechanism 2) — not yet implemented anywhere.
3. If neither resolves and more than one Provider is `AVAILABLE`, **compilation fails**
   with a named, actionable error, rather than silently picking the first candidate the
   way `SkillRegistry.select_tool()` does today. This is a stricter behavior than what
   exists in `video-production-agent` right now and is called out as a gap to close, not
   something already true.

Either way, **Provider selection happens at compile time, before the Operation exists**,
and the chosen `provider_id`/`skill_id`/`skill_version` is recorded on the `Operation`
(`SPEC.md` §4) and later on the `ProductionReceipt` (`SPEC.md` §6). An Operation is never
compiled with an unresolved Provider — this is what makes an Operation "one deterministic
tool invocation" rather than a decision deferred to run time.

### 1.2 Executor: Operation → Artifact (CURRENT)

`execution/executor.py` runs a compiled `Operation` via a `ToolRouter`, which is the
concrete piece of the **Runtime** contract (`CORE_PRIMITIVES.md` §4): it locates the
target Skill's adapter, invokes it as a subprocess, and turns the Skill's `--json`
response into an `ExecutionResult` (`SPEC.md` §4) and, on success, one or more `Artifact`s
(`ARTIFACT_MODEL.md`).

This is one call in, one call out — per `REPOSITORY_MAP.md`, "every external Skill is
called as one subprocess per call, JSON in/out, via a per-skill adapter." The Executor
does not batch, pipeline, or stream across Operations; each Operation is a complete,
self-contained subprocess lifecycle.

## 2. DAG execution order (CURRENT shape, PROPOSED generalization)

### 2.1 What exists today

`video-production-agent`'s Plan/step model is already graph-shaped internally
(`CORE_PRIMITIVES.md` §6): each `ProductionStep` has `depends_on: [StepId]`, and
`plan_status`/`step_status` are always *derived* from Decision states rather than set by
hand — an invariant this document keeps unchanged. The Executor processes steps in an
order consistent with `depends_on`; no repo audited runs two Operations concurrently.

### 2.2 Topological execution (PROPOSED formalization, not a new engine)

This document names, but does not invent, the obvious execution discipline implied by
the existing `depends_on` field: the Executor performs a topological walk of the Plan's
step graph, executing one step at a time, in an order where every step's dependencies
have already produced their declared output Artifacts before that step compiles/runs.
Structural Plan validation (`SPEC.md` §3, `ARCHITECTURE.md` §8 item 4) already requires
the `depends_on` graph to be acyclic before execution begins — a cycle is a validation
failure, not a runtime deadlock to detect later.

Because the ecosystem shows no evidence of a need for concurrent execution (§0 above),
this is **strictly sequential** topological execution: one Operation runs, completes (or
fails), and only then does the Executor consider the next step whose dependencies are
now satisfied. This is not a limitation this document apologizes for — it is a direct,
disciplined consequence of `ARCHITECTURE.md` §9 lens 5 (Performance): "no evidence of
scale that would matter... not solved for because it is not yet a real problem."

A DAG with independent branches (e.g. an audio-cleanup step and a color-grading step that
share no inputs) is still executed one Operation at a time under this model; the DAG
shape exists to express *dependency correctness* (what must finish before what can start,
and what a QC gate attaches to — `ARCHITECTURE.md` §6), not to express an opportunity for
parallelism this document has no evidence is needed. If a future Roadmap phase finds
concrete evidence of a bottleneck, that is where a concurrency model would be designed —
against real numbers, not anticipated here.

## 3. Idempotency and resume

### 3.1 What exists today (CURRENT)

Every `Operation` carries an `idempotency_key` (`SPEC.md` §4). `render --resume
last|JOB_ID` (`CORE_PRIMITIVES.md` §11, Job) uses this key to determine which Operations
in a previously-started `Job` already completed successfully and can be skipped, versus
which must (re-)run. This is real, working resume support, not a proposal — it is the
mechanism behind `video-production-agent`'s documented `render --resume` CLI flag.

The `Job` (`video_agent.jobs.job`) is the unit this resume operates over: one execution
run of a `ProductionPlan`. A `Job` can be interrupted (process killed, machine restarted,
timeout) and resumed by re-invoking `render --resume` against the same `job_id`, which
re-walks the Plan's DAG and, for each step, checks whether an Operation with a matching
`idempotency_key` already has a recorded successful `ExecutionResult` before re-running
it.

### 3.2 What the idempotency key is keyed on (CURRENT, as verified)

Per `REPOSITORY_MAP.md`'s provenance findings, an `Operation`'s identity is meant to be
reproducible from its inputs, not from wall-clock state — this mirrors (though is a
distinct mechanism from) `qc-skill`'s `identity` scheme (`SPEC.md` §5), which explicitly
excludes timestamps and paths. This document treats that as the correct precedent:
`idempotency_key` should be derived from `{capability_id, provider_id, skill_version,
params, input_artifact_ids}` — the exact set of things that determine whether re-running
this Operation would produce a different result — not from a request id or a timestamp.
**The precise field list used by `execution/compiler.py` today was not independently
re-derived from source for this document; the general shape above is inferred from the
documented behavior (`render --resume` skipping unchanged steps) and from the sibling
`qc-skill` identity pattern it is consistent with. Treat the exact hashed field set as
UNKNOWN pending direct code citation, not as verified.**

### 3.3 What is PROPOSED beyond today

- **Cross-run cache reuse, not just within-Job resume.** Today's `--resume` is scoped to
  one `job_id`. A generalization worth naming (not yet built anywhere): if a *different*
  Job's Operation has an identical `idempotency_key` (same capability, provider, params,
  and input artifact hashes), its Artifact could be reused rather than recomputed —
  this is exactly the `qc-skill` cache-hit pattern (`ARTIFACT_MODEL.md` §Caching) lifted
  from one Skill to the Execution layer generally. This is **PROPOSED**, not implemented;
  no audited repo does cross-Job Operation caching today.
- **Idempotency key as part of the Capability Contract.** `SPEC.md` §1 already includes
  `idempotency_hint` on `ffmpeg-skill`'s `ToolSpec` (e.g. `"cached"` on `batch` only,
  per `REPOSITORY_MAP.md`). Generalizing this so every Capability declares whether/how its
  outputs are cacheable is a natural extension of an existing field, not a new concept —
  but only `ffmpeg-skill`'s `batch` tool actually implements caching today; treat the
  field as **declared but mostly unused** across the ecosystem (CURRENT: `ffmpeg-skill`'s
  field and `batch`'s behavior; PROPOSED: universal adoption).

## 4. Runtime safety guarantees at this layer

The Execution layer is where the **Runtime** contract (`CORE_PRIMITIVES.md` §4) is
actually enforced, per Operation, per subprocess:

- **Subprocess isolation.** Every Operation invokes exactly one Skill adapter as a
  single subprocess in its own process group (CURRENT — verified in
  `video-editing-skill`/`audio-production-skill`'s AST-walked "exactly one subprocess
  module" tests, and in `video-production-agent`'s own per-skill adapters). A timeout
  kills the whole process group, not just the parent (`REPOSITORY_MAP.md`,
  `video-production-agent` security section).
- **Timeouts.** Each `Operation` carries `timeout_seconds` (`SPEC.md` §4). The Executor
  enforces this at the subprocess boundary. **Honest gap, carried over from
  `REPOSITORY_MAP.md`:** `ffmpeg-skill`'s own scripts do not enforce a per-encode timeout
  internally (only `verify.py` does) — the Execution layer's timeout is the outer
  safety net for a Skill that does not bound itself, not a redundant second layer.
- **`FORBIDDEN_KEYS` / `FORBIDDEN_ARG_KEYS`.** Before an `Operation`'s
  `argv_or_request` is handed to any adapter, parameter keys such as `command`, `argv`,
  `shell`, `exec`, `filter_complex`, `api_key`, `token` are blocked recursively (CURRENT,
  `video-production-agent`'s `FORBIDDEN_ARG_KEYS`, and independently reimplemented per-Skill
  per `REPOSITORY_MAP.md` finding 3). This check happens at Operation-execution time, not
  only at Plan-validation time — a Plan can be structurally valid and still be checked
  again at the point where a raw request is about to leave the process boundary, which is
  the correct place to catch it per `ARCHITECTURE.md` §7's "any text extracted from
  untrusted media" principle generalized to any hostile parameter.
- **`SYSTEM_CONSTRAINTS` — bounded retry.** `execution.no_raw_shell` and
  `execution.recovery.max_attempts=2` are hard-coded system constraints (CURRENT,
  `REPOSITORY_MAP.md`). This means `execution/recovery.py`'s retry logic is bounded: a
  failed Operation may be retried, but never more than twice, and never by silently
  escalating to a raw/unsafe execution path. This document treats `max_attempts=2` as a
  **verified system constraint to preserve**, not a default this document is free to
  change — no evidence was gathered on why 2 specifically, and none is fabricated here.
  What retry actually changes between attempts (same params re-run vs. some adjusted
  parameter) is **UNKNOWN** — `execution/recovery.py`'s internal retry strategy was named
  in the audit as existing, but its precise behavior (backoff, parameter mutation, or
  plain re-invocation) was not verified in enough depth for this document to describe
  further without fabricating detail.
- **No raw shell, ever.** Confirmed by grep across all 11 repos (`ARCHITECTURE.md` §11)
  that no `shell=True`/`os.system` exists anywhere. The Execution layer is the last place
  this guarantee is enforced before a Skill's own process boundary takes over — and the
  Skill boundary itself is expected (per `SKILL_SPEC.md`'s forthcoming conformance suite,
  referenced in `ARCHITECTURE.md` §9 lens 3) to hold the same guarantee independently, so
  a non-conformant third-party Skill cannot bypass the OS-side check by simply not
  cooperating with it — the Runtime's own subprocess boundary (list-argv only, environment
  scrubbing) is what actually prevents shell injection regardless of what the Skill's
  internals do with the arguments it receives.

## 5. Partial execution and checkpointing

### 5.1 What "partial" means here (CURRENT)

Because execution is a strictly sequential topological walk (§2.2), "partial execution"
is simply: some prefix of the Plan's steps completed and produced Artifacts, and the
walk stopped (failure, timeout exhausted after bounded retry, or human interruption)
before reaching the end. There is no separate "checkpoint" object beyond what already
exists: the set of Artifacts already produced by completed Operations, plus the `Job`'s
own record of which `idempotency_key`s have a successful `ExecutionResult`, together
**are** the checkpoint. `render --resume` (§3.1) reads exactly this state to continue.

### 5.2 What Artifacts exist mid-Plan

At any point during execution, the Artifacts that exist are exactly the declared
`outputs` of every step whose Operation has completed successfully so far — each tagged
with the `stage` it was produced at (`working`, typically, until a later
approval/QC step promotes it — see `ARTIFACT_MODEL.md` §Lifecycle). A Plan that has only
partially executed has a well-defined, inspectable set of intermediate Artifacts; nothing
is buffered in memory across Operations that isn't also durably written as an Artifact,
because each Operation is its own subprocess lifecycle (§1.2) with no shared in-process
state to lose. This is a direct, favorable consequence of the one-subprocess-per-call
design already in place — it was not designed for checkpointing, but it provides
checkpointing for free.

### 5.3 What is PROPOSED beyond today

- **Explicit checkpoint Artifacts.** No audited repo emits a distinct "Plan execution
  checkpoint" artifact type separate from the ordinary output Artifacts of completed
  steps. This document does not propose adding one — the Job/idempotency-key record
  already serves this purpose and a second representation of the same fact would be
  exactly the kind of unjustified duplication `ARCHITECTURE.md` §9 lens 1 argues against.
- **Partial-failure Receipts.** `SPEC.md` §6 already specifies that a `ProductionReceipt`
  is "emitted once, at the end of a completed (not necessarily fully-passing) Plan
  execution." A Plan that stops partway through (not merely one that finishes with QC
  failures) does not yet have a defined Receipt behavior — should a partial run emit a
  partial Receipt documenting what did complete? This is an open question, not answered
  here; it belongs with `PROVENANCE.md` when that document is written, and is named here
  so it is not silently assumed either way.

## 6. What this document deliberately does not add

Restating §0 for emphasis, because the temptation to add these is real and the evidence
does not support any of them:

- No scheduler, no worker pool, no task queue, no concurrency limit configuration.
- No distributed execution / remote workers.
- No new DAG or workflow engine — the Plan's own `steps`/`depends_on` is the DAG.
- No speculative/parallel execution of independent branches.

If a future Skill or Agent surfaces concrete evidence that any of these is needed (a
Plan with enough independent branches that sequential execution is a measured
bottleneck, for instance), that evidence — not this document's imagination — is what
should drive the design, in a later Roadmap phase.
