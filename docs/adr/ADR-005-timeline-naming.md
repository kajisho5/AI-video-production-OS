# ADR-005: "Timeline" Names Two Distinct Concepts and Must Not Be Overloaded

Status: Accepted

## Context

This ADR exists only because a real naming collision was found during the audit, not
because timeline modeling was independently identified as a design priority.
`REPOSITORY_MAP.md`'s `video-production-agent` review and `CORE_PRIMITIVES.md` §8 both
confirm: `video-production-agent` already has a module `temporal/timeline.py`, but it
models **event history over wall-clock/media time** — which event kinds are "active" in a
time range, an observability/session concept — not an **edit timeline** in the sense of
clips, tracks, transitions, captions, and markers (the OpenTimelineIO-style domain model
of an edited sequence).

No edit-timeline primitive exists anywhere in the ecosystem today. The Project IR's
`timeline` section in `schemas/project.schema.json` is the closest thing, but
`REPOSITORY_MAP.md` notes it "has not been audited in enough depth to know how close." If
this OS were to introduce a new edit-timeline concept and casually call it `Timeline`
without addressing the existing `temporal/timeline.py`, it would recreate, at the OS
level, exactly the kind of undetected naming collision that ADR-001 and ADR-002 already
had to fix for "Skill."

## Decision

Treat these as two distinct primitives that must never share a name:

- The existing module stays **`Event Timeline`** / `temporal` — unchanged, out of scope
  for this OS's new work.
- The new, proposed edit-timeline concept is named **`Timeline`** going forward, modeled
  on OpenTimelineIO's clip/track/transition/marker shape (validated prior art) rather than
  invented from scratch. It is `FUTURE` work (Roadmap Phase 3+), not implemented today.

## Consequences

- Any documentation, contract field, or code introduced by this OS that refers to
  `Timeline` unambiguously means the edit-timeline concept; anything referring to the
  event-history concept must say `Event Timeline` or `temporal` explicitly, never bare
  `Timeline`.
- The relationship between the new `Timeline` artifact and the Project IR's existing
  `timeline` section in `schemas/project.schema.json` is an open question this ADR does
  not resolve — it must be audited before `Timeline` implementation begins, since the two
  may already overlap.
- No code changes are required by this ADR alone; it is a naming contract that future
  Timeline design work (`TIMELINE_MODEL.md`) must honor.

## Alternatives Considered

**Reuse the name `Timeline` for the new edit-timeline concept without renaming or
disambiguating the existing `temporal/timeline.py`.** Rejected outright — this is the
status quo risk this ADR exists to prevent. Two different meanings of the same bare name
inside one ecosystem is exactly the class of defect (see ADR-001, ADR-002) that this OS's
whole reason for existing is to catch and fix, not reproduce at the primitive-naming
level.
