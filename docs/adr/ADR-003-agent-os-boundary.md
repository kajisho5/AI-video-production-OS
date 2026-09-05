# ADR-003: The OS/Agent Boundary Is a Dependency Direction, Not a Repo Split

Status: Accepted

## Context

`ARCHITECTURE.md` §3 defines the OS/Agent boundary as a dependency direction and
type-ownership rule, not a mandated deployment split: the OS owns the *shape* of
Observation, Inference, Decision, ProductionPlan, Operation, Artifact, Capability,
QCReport, and ProductionReceipt as a versioned contract package; the Agent owns the
*logic* that produces a Decision from an Observation, planning strategy, and
orchestration order. The OS never imports or depends on Agent logic; an Agent always
depends on the OS contract, never the reverse.

This is not invented from nothing. `REPOSITORY_MAP.md` documents that
`video-production-agent` already keeps its own O→I→D→Plan pipeline internally
deterministic and treats AI output as untrusted: `providers/base.py` defines a generic
`AIProvider` interface, the only shipped implementation is `NullProvider`, no
Anthropic/OpenAI SDK is imported anywhere, and "the system already works, end-to-end, for
deterministic operations (silence trim, loudness normalize) without any LLM in the loop."
The Inference/Decision layer that exists is a deterministic rule engine
(`policy/rules.py`, `agent/decision_engine.py`), and when an AI provider does exist, its
output is tagged `provenance="AI_GENERATED"`, treated as untrusted input, validated
against system-defined structure, and never becomes an executable Decision by itself.

In other words, `video-production-agent` already behaves like "Agent logic sitting on top
of OS-shaped contracts" — it just currently owns both halves in one repository because no
separate OS package exists yet for it to depend on instead.

## Decision

Formalize the OS/Agent boundary as: OS owns type shapes, Agent owns logic, and dependency
direction is always Agent → OS contract. Do not require `video-production-agent` to
physically split into two repositories now. `video_agent.models.{Observation, Inference,
Decision, ...}` are named as *candidates* to become an independent OS contract package
(`avpos-contracts` or similar) that `video-production-agent` would then depend on — a
refactor, not a rewrite, deferred to a later Roadmap phase.

## Consequences

- The boundary can be adopted immediately as a documented contract, with zero disruption
  to the one working Agent implementation that exists today.
- `video-production-agent`'s current in-repo type definitions are explicitly named as a
  gap against this boundary (types live inside the Agent's own tree instead of a shared
  package), tracked as Roadmap work, not hidden or claimed as already solved.
- Any future Agent (a different AI system, or a human at a CLI) can adopt the same
  contract without needing `video-production-agent` to exist or be modified.

## Alternatives Considered

**Mandate immediately splitting `video-production-agent` into two repositories.**
Rejected. No evidence in `REPOSITORY_MAP.md` or `ROADMAP.md`'s Phase 1–2 scope shows this
is needed before other, more foundational OS work (contract format, registry) lands.
Forcing a repo split on day one would be premature architecture work against a boundary
that is already correctly observed in practice (NullProvider, deterministic pipeline) even
though it is not yet physically separated in the filesystem.
