# ADR-006: ProductionPlan Is a DAG of Operations Over Artifacts

Status: Accepted

## Context

`CORE_PRIMITIVES.md` §6 and `ARCHITECTURE.md` §6 address composability: should the
execution model be a fixed linear pipeline (media-analysis → editing → audio → color →
subtitle → graphics → thumbnail → qc), or a general dependency graph? The frequently
drawn linear sequence is one common *shape*, not a mandated order.

This is not a new engine proposal. `video-production-agent`'s existing plan/step model is
already graph-shaped internally: a `ProductionPlan` is a DAG of `ProductionStep`s derived
from approved Decisions, `plan_status`/`step_status` are always computed from decision
states (never set by hand — a kept invariant), and the plan compiles into `Operation`s —
"one deterministic tool invocation" with typed args, never raw argv/shell
(`execution/compiler.py`). Execution and resumability already work via
`Operation.idempotency_key`, used by `render --resume last|JOB_ID` (`SPEC.md` §4,
`CORE_PRIMITIVES.md` §11). QC gates attach naturally to artifacts (a rough-cut, a graded
master, a captioned export) rather than to abstract task nodes, which an artifact-centric
DAG models directly.

## Decision

Formalize `ProductionPlan` as a DAG of `Operations` over `Artifacts`, building on
`video-production-agent`'s existing compiler/executor/`Operation.idempotency_key`
mechanics rather than replacing them. Structural validation (does every referenced
Capability/Artifact exist, are types compatible, is the `depends_on` graph acyclic) is a
kernel responsibility; a pipeline is simply one specific DAG shape among many, not a
special-cased concept.

## Consequences

- No new execution engine is introduced; existing compiler/executor code is reused as-is.
- Future Skills and pipeline authors are documented not to assume linearity, avoiding
  accidental special-casing of the "editing → audio → color → ..." order.
- The DAG-over-Artifacts framing lets QC gates and other verification steps attach to
  artifacts naturally, matching how `qc-skill` already verifies concrete outputs, not
  abstract pipeline stages.
- Resumability (`idempotency_key`) continues to work exactly as it does today.

## Alternatives Considered

**Adopt a dedicated workflow engine (Temporal, Airflow, or similar).** Rejected for now.
`ARCHITECTURE.md` §9 (lens 5, Performance) and §10 (Resource model) note: "no evidence of
scale that would matter (single-machine, local-first ecosystem, no repo shows more than a
handful of concurrent operations)." No repository in the ecosystem has any CPU/GPU/
concurrency scheduling today, and introducing a distributed workflow engine's operational
complexity (separate service, persistence layer, worker fleet) against a system that runs
as a single local CLI process today would be solving a problem that does not yet exist —
exactly the "architecture astronautics" this project's rules warn against. Revisit only
if/when true distributed execution across multiple machines becomes a real, evidenced
need (see `ARCHITECTURE.md` §10, Roadmap Phase 7+).
