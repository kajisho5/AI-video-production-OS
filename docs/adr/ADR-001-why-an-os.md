# ADR-001: Why Build an OS-Shaped Set of Contracts at All

Status: Accepted

## Context

The obvious alternative to this whole project is: don't build an OS, just keep improving
`video-production-agent` directly, and let each Skill repo evolve independently. That
alternative has already been tried, implicitly, and it has already produced real defects
— not hypothetical ones — documented in `REPOSITORY_MAP.md`:

1. **`transcription-skill` exists outside the task's original "9 skills" list.**
   `REPOSITORY_MAP.md` states plainly: "Not in the task's original list of 9 skills, but a
   real, active ecosystem member... The original task brief's '9 skills' framing is
   already stale." A fixed, hardcoded skill roster — the natural output of "just improve
   the Agent repo" — cannot represent an ecosystem that already grew past its own initial
   count.

2. **The `Skill` naming collision inside `video-production-agent`'s own source.**
   `REPOSITORY_MAP.md`: "the word 'Skill' is used for two different things in this
   codebase: (a) an external repository/package (`SkillPackage`)... and (b) the agent's
   internal notion of a production capability it knows how to plan for (`SkillSpec`)...
   This is a real, present naming ambiguity in the source, not a hypothetical concern."
   This confusion originated and festered *inside* the one repo that would be the target
   of an "improve it directly" strategy — because that repo has no external contract
   layer to force the distinction.

3. **The `qc-skill` / `media-analysis-skill` duplication.** `REPOSITORY_MAP.md` finding 2:
   silence, loudness, and decode-integrity measurement are "each independently
   implemented twice... with no shared library between them," and "awareness is
   one-directional" — `media-analysis-skill` doesn't even know `qc-skill` exists. Two
   *separate* repos converged on duplicate logic because nothing outside either repo could
   notice or prevent it.

## Decision

Build a shared, versioned contract layer (this OS) that sits *outside* and *above* every
individual repo, rather than continuing to fix these problems one repo at a time.

## Consequences

- A capability registry becomes possible, so a new Skill (or an old one disappearing)
  never requires editing a hardcoded list anywhere.
- "Skill" gets a precise, single meaning; the ambiguous second sense becomes "Capability"
  (see ADR-002).
- Two Skills claiming the same Capability id become a visible, resolvable registry fact
  instead of silent, undetected duplication.
- This adds an explicit contract-maintenance cost: repos must publish conformant
  contracts rather than evolving purely ad hoc.

## Alternatives Considered

**Keep improving `video-production-agent` directly, per-repo.** Rejected: this is not a
hypothetical inferior option, it is the *status quo*, and the status quo already produced
all three problems above. Ad-hoc fixes inside one repo cannot fix a collision between two
*other*, independent repos (`qc-skill` vs `media-analysis-skill`), and cannot prevent a
naming ambiguity from re-emerging the next time a new Skill or capability is added,
because nothing forces a shared vocabulary across repo boundaries.
