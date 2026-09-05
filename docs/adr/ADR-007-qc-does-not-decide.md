# ADR-007: Verification Capabilities Must Never Make Production Decisions

Status: Accepted

## Context

`REPOSITORY_MAP.md` documents that `qc-skill` already enforces this boundary explicitly
and in code, not just in prose: "qc-skill is not an AI agent and does not make production
decisions" is stated in `qc-skill`'s own README and codified as ADR-001 in
`qc-skill/docs/decisions.md`. Critically, this was verified at the code level during the
audit: "No decision/render/publish/block logic exists in the code outside
boundary-documentation comments." `qc-skill`'s `QCReport` model reflects this by
construction — `overall_status` is `PASS | WARN | FAIL | UNKNOWN` with worst-wins
aggregation, and it defaults to `UNKNOWN` (never silently `PASS`) when no checks ran. A
`FAIL` is a fact about measurements, never an instruction to re-render, block a publish,
or take any other action.

`ARCHITECTURE.md` §3 elevates this to an OS-wide principle: "the OS never makes a
production decision (a QC `FAIL` is a fact, not an instruction to re-render —
`qc-skill`'s own ADR-001 already enforces exactly this and is the reference
implementation for QC's role)."

## Decision

Formalize, as an OS-wide contract requirement for **any** Capability whose role is
verification/measurement (not just `qc-skill`): the Capability may produce Observations,
Measurements, Findings, and Reports, but must contain zero decision, render, publish, or
block logic. Consuming a verification Report to decide what happens next (re-render,
proceed, halt) is exclusively the Agent's responsibility, mediated through the
Decision type (`CORE_PRIMITIVES.md` §5), never the verification Skill's own code path.

## Consequences

- Any future verification Skill (a new QC-like or analysis-like Capability) must pass a
  conformance check equivalent to what was found for `qc-skill`: no code path that acts
  on its own findings beyond reporting them.
- Agents remain free to encode arbitrary policy ("FAIL on delivery checks blocks
  publish") but that policy lives in Agent logic or a Decision, never inside the
  verification Skill.
- This closes off a specific failure mode: a verification Skill silently gaining
  side-effecting behavior (e.g. auto-retrying a render) in a later version without an
  Agent or human ever approving that behavior.

## Alternatives Considered

**Leave this as `qc-skill`'s own internal convention, not an OS-wide rule.** Rejected.
`media-analysis-skill` and any future verification Capability are architecturally
identical in kind (they measure and report, never act), so leaving the boundary
unenforced outside `qc-skill` would mean the exact same discipline could quietly erode in
the next verification Skill built without a documented reason to keep it. Because the
code-level enforcement in `qc-skill` was found, not assumed, this is a proven pattern
being generalized — not a new rule invented for this document.
