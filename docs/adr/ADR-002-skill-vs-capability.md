# ADR-002: Split "Skill" into Capability / Skill / Provider / Runtime

Status: Accepted

## Context

`CAPABILITY_MODEL.md` identifies this as "the single most consequential decision in this
architecture." The primary justifying evidence is the `qc-skill` / `media-analysis-skill`
collision documented in `REPOSITORY_MAP.md`: silence detection, loudness measurement, and
decode-integrity checking are "each independently implemented twice... with no shared
library between them," and `media-analysis-skill`'s own docs contain "zero references to
`qc-skill`, despite acknowledging overlap with `ffmpeg-skill` by name." No concept in
either repo, and no concept in `video-production-agent`, currently distinguishes "the
thing being accomplished" (loudness measurement) from "the package that accomplishes it"
(`qc-skill` vs. `media-analysis-skill`). That missing distinction is exactly why the
duplication went unnoticed.

Compounding this, `REPOSITORY_MAP.md` also documents that `video-production-agent`'s own
source already overloads the word "Skill" for two different things: `SkillPackage` (an
external repo) and `SkillSpec` (an internal capability name like `silence_cleanup`).

## Decision

Adopt four distinct concepts, as specified in `CAPABILITY_MODEL.md`:

- **Capability** — "what can be accomplished" (e.g. `measure.audio.loudness`), owned by
  the OS registry.
- **Skill** — "what package ships the code" (e.g. `qc-skill` the repo), owned by
  independent authors.
- **Provider** — "which implementation does it," a Skill registered against a Capability
  id. `qc-skill` and `media-analysis-skill` both become registered Providers of
  `measure.audio.loudness`.
- **Runtime** — "how it actually executes" (subprocess isolation, path policy, timeouts),
  an OS reference library plus conformance tests.

Under this model, the qc-skill/media-analysis-skill duplication stops being invisible: it
becomes two Providers registered against one Capability id, a fact the registry can
surface and a collision policy (Plan-time choice → default-provider policy → registry
refusal) can resolve.

## Consequences

- Every existing Skill's `contract.py` gains a few new declared fields (capability id,
  provider id) but requires no new code, per `ARCHITECTURE.md` §9's developer-experience
  red-team lens.
- Capability collision becomes a first-class, resolvable registry event instead of silent
  duplication.
- Four nouns instead of one is more conceptual surface area — accepted only because each
  noun does a job the single overloaded noun could not.

## Alternatives Considered

**Keep "Skill" as the only noun.** Rejected. A single noun cannot distinguish "what can be
done" from "what package does it" — and that is precisely the ambiguity that let the
qc-skill/media-analysis-skill collision go unnoticed for two independently-built repos.
Keeping one noun would leave the OS with no vocabulary to even describe the problem it
exists to fix.
