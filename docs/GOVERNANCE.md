# Governance

Status: **CURRENT process, draft, 2026-09-05.** This document describes how decisions
actually get made in this project today, and how that should change if the project grows
beyond one maintainer. It is intentionally lightweight: `AI-video-production-OS` is a
single-owner (`kajisho5`) project, pre-1.0 across all 11 repos in the ecosystem
(`REPOSITORY_MAP.md`), with no outside contributors today. A governance document sized for
a foundation or a multi-vendor standards body would be inventing process for a scale this
project has not reached — the same "no abstraction without concrete value" rule
(`CAPABILITY_MODEL.md`, `ARCHITECTURE.md` §9) applies to process as much as it applies to
code. This document says what exists, not what might one day be needed.

## How to read this doc

This is a process document, not a technical spec. It does not use the
CURRENT/FUTURE/EXPERIMENTAL/UNKNOWN tagging convention from `DESIGN_SYSTEM.md` at
paragraph granularity, because almost everything below is CURRENT practice (things the
ecosystem's repos already do) or an explicit, clearly-labeled proposal for this specific
project. Where something is speculative, it is called out by name in §4 rather than tagged
inline.

## 1. Who decides what, today

There is one maintainer (`kajisho5`) and no other contributors as of this writing. In that
state, governance is simple by necessity: the maintainer makes and records decisions. The
value of writing this document now is not to constrain a nonexistent group of
contributors — it is to make the maintainer's own decisions **legible and reproducible**,
so that (a) future-them can recover why a past decision was made, and (b) a future
contributor can join without an oral-history handoff.

This is not a novel practice being imposed on the ecosystem. Per `REPOSITORY_MAP.md`, at
least four of the audited repos already do exactly this, independently, with no shared
process document: `video-production-agent` has accumulated **34 ADRs**, and
`qc-skill`, `media-analysis-skill`, `color-grading-skill`, `motion-graphics-skill`, and
`audio-production-skill` each keep a `docs/decisions.md` ADR log. Five different
single-commit repos, built by the same person but without a written mandate to do so,
converged on the same practice. That convergence is the evidence base for §2 — this
document formalizes an already-working habit, it does not introduce a new one.

## 2. Architectural decisions: ADRs

**Decision rule:** any decision that changes a shared contract, a Capability's declared
shape, a security guarantee, or the boundary between the OS and an Agent/Skill gets an
Architecture Decision Record. A decision that is purely internal to one Skill's own
implementation detail does not require one at the OS-repo level (it may still get one in
that Skill's own `docs/decisions.md`, per its own existing convention).

**Format and location:** ADRs for this repository (`AI-video-production-OS`) live in
`docs/adr/`, one file per decision, numbered sequentially
(`0001-title-in-kebab-case.md`, `0002-...`). Each ADR states, at minimum:

- **Status** — proposed, accepted, superseded (by which ADR), or deprecated.
- **Context** — the problem or evidence that prompted the decision (ideally citing the
  specific `REPOSITORY_MAP.md` finding or real code, per this project's own evidence-first
  norm — see `ARCHITECTURE.md` §2).
- **Decision** — what was decided, stated plainly.
- **Consequences** — what this makes easier, harder, or forecloses.

This mirrors the shape already used across the ecosystem's `docs/decisions.md` logs (e.g.
`qc-skill` ADR-001, `media-analysis-skill` ADR-010, `transcription-skill` ADR-002/ADR-021,
all referenced in `REPOSITORY_MAP.md`) — the format is not invented here, it is adopted
because it already demonstrably works across five independent repos in this same
ecosystem.

**Who writes one:** today, the maintainer, at the point a decision is made — not
retroactively, and not for decisions still under consideration (a still-open question
belongs in a document's own "open questions" section, as `ARCHITECTURE.md` §12 and
`SKILL_SPEC.md` §9 already do, until it resolves into an ADR).

**Relationship to per-repo ADR logs:** `docs/adr/` in this repository records decisions
about the **OS-level contracts** (`SPEC.md`, `CAPABILITY_MODEL.md`, `CORE_PRIMITIVES.md`,
etc.). It does not replace or duplicate any individual Skill repo's own
`docs/decisions.md` — those remain each Skill's own record of its own internal decisions,
exactly as they exist today. An OS-level ADR may reference a Skill's ADR as evidence
(as `REPOSITORY_MAP.md` and `CAPABILITY_MODEL.md` already do), but does not own it.

## 3. Proposing a new Skill or a breaking contract change

This document does not redefine either process — both already have their own home:

- **Proposing a new Skill** (should this be a new Skill, a new Capability inside an
  existing Skill, or a new Provider — per `CAPABILITY_MODEL.md`'s granularity criteria) —
  see `SKILL_PROPOSAL.md`.
- **Reviewing a breaking change to a shared contract** (a `CapabilityContract` shape
  change, a `contract_version` bump, an OS kernel contract change per `SPEC.md`) — see
  `VERSIONING.md`.

Both processes route their final decision, if accepted, into an ADR per §2 — proposal and
review are how a decision gets made; the ADR is how it gets recorded.

## 4. When this changes (speculative — do not build this now)

Everything below is explicitly **FUTURE and speculative**. None of it should be built,
adopted, or even lightly prototyped until its trigger condition is actually true — building
it now would be exactly the "architecture astronautics" this project's own rules argue
against (`ARCHITECTURE.md` §9, lens 5; §10). It is written down only so that, if the
trigger condition is met, there is a plan to reach for instead of improvising one under
pressure.

- **Trigger: a second regular contributor.** Add a lightweight `CONTRIBUTING.md` (PR
  process, how to run each repo's test suite, coding conventions) and start using PR
  review instead of direct commits for OS-level contract changes. No CLA, no DCO
  requirement yet — add a DCO (`Signed-off-by` line) only if a contributor's employer
  requires it, not preemptively.
- **Trigger: a third-party Skill author who does not report to the maintainer.** Formalize
  the `SKILL_PROPOSAL.md` review into an actual asynchronous review process (issue
  template, explicit acceptance criteria checklist against `SKILL_SPEC.md` §8's
  conformance requirements) — today this is unnecessary because the same person authors
  every Skill in the ecosystem.
- **Trigger: a contested architectural decision** (two people disagree about an OS-kernel
  contract change and there is no longer a single maintainer to break the tie). Add an
  explicit decision-maker-of-last-resort rule (e.g. a small maintainers group with a
  documented tie-break) at that point — not before, because designing a voting or
  escalation process for a group that does not exist yet has no evidence behind it, per
  this project's own standard for what belongs in a document (`ARCHITECTURE.md` §2).
- **Explicitly not planned, absent much larger scale:** a foundation, a steering
  committee, a formal CLA process, or a trademark policy. Nothing in the current
  ecosystem (11 single-owner repos, no external PRs on record) provides evidence these are
  needed, and inventing them now would misrepresent the project's actual size to anyone
  reading this document.

## 5. What this document deliberately does not define

- A code of conduct — worth adding at the point external contributors actually show up,
  not before; most hosting platforms provide a usable default template at that time.
- A security-disclosure process for the ecosystem's Skills — each Skill's own
  security posture is covered by `SKILL_SPEC.md` §3–4; a coordinated-disclosure process
  across repos is future work once there is a security-relevant report to coordinate.
- Funding, licensing changes, or trademark — out of scope for a process document; see
  each repo's own `LICENSE` file for its current terms.
