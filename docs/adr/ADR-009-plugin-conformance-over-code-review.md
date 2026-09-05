# ADR-009: Third-Party Skill Safety via Black-Box Conformance Tests, Not Manual Code Review

Status: Accepted

## Context

Every existing Skill repo independently reinvented the same security primitives.
`REPOSITORY_MAP.md` finding 3 states this precisely: "Every skill repo independently
reinvented the same security primitives: a `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS`
denylist, a `PathPolicy` with symlink-resolved containment, `shell=False` everywhere,
workspace-confined output, no-clobber-of-input. This convergent design is strong evidence
these primitives belong in a shared OS-level contract/library." The pattern was found,
independently, across at least seven repos (`video-production-agent`, `ffmpeg-skill`,
`qc-skill`, `media-analysis-skill`, `video-editing-skill`, `audio-production-skill`,
`color-grading-skill`), and `video-editing-skill`/`audio-production-skill` go further,
each running "a dedicated security test that statically walks the AST of every module to
prove no other `subprocess` call exists anywhere else in the codebase."

The problem `ARCHITECTURE.md` §9 (lens 3, Security) identifies with formalizing this only
as a shared reference library: "does formalizing `FORBIDDEN_KEYS` centrally create a
single point of bypass if a third-party Skill just doesn't use the reference library?"
This is a real risk once third-party, non-Python, or non-cooperative Skills join an open
ecosystem — voluntary library adoption cannot be verified or enforced. A documented,
ongoing cautionary example of exactly this failure mode is the VS Code extension host: its
sandboxing model has been the subject of continued public security research showing that
extensions running with broad host privileges are difficult to safely contain after the
fact, once an ecosystem exists and extensions are trusted by convention rather than by
verified behavior.

## Decision

Enforce third-party Skill safety via a **black-box conformance test suite** — derived
from the convergent `FORBIDDEN_KEYS`/`PathPolicy`/`shell=False` pattern independently
found across 7+ existing repos — that any Skill must pass regardless of implementation
language, rather than relying on manual OS-maintainer review of each Skill's internal
source code.

## Consequences

- A Skill's compliance is checked by observable behavior (does it reject forbidden
  parameter keys, does it refuse path traversal, does it ever shell out) rather than by
  a human reading its source, which does not scale and cannot be repeated on every
  release.
- Non-Python Skills can conform without an OS maintainer needing to read or trust an
  unfamiliar language's internals — the Runtime contract is process-boundary-shaped
  exactly like every audited Skill already is.
- This still permits a Skill to pass conformance tests while containing unrelated
  internal issues the tests don't target — conformance is a floor, not a full security
  audit.

## Alternatives Considered

**Manual OS-maintainer code review of every third-party Skill's internals before
acceptance.** Rejected, using the VS Code extension-host experience as the cautionary
precedent this design explicitly avoids repeating: relying on voluntary adoption of safe
patterns (or one-time manual review) does not scale as an ecosystem grows and does not
catch a Skill that later drifts away from reviewed behavior in a subsequent release.
Requiring behavioral, automatically-re-checkable conformance instead of trusting a
one-time human review is the design choice this ADR makes explicitly to avoid that
outcome.
