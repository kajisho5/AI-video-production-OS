# Reference Capability registry

**Status: CURRENT / IMPLEMENTED.** This is `docs/ROADMAP.md` Phase 1's schema/registry
library: a small, dependency-free, tested Python package that loads real
`CapabilityContract` documents, answers "who provides Capability X", detects real
Capability collisions, and applies `docs/CAPABILITY_MODEL.md`'s 3-tier collision policy.

```
python3 -m unittest discover -s registry/tests -t .
```

## What this is

- `contract.py` — `skill_identity(doc)` (resolves the ecosystem's three real
  skill-identity shapes: flat `skill_id`, flat `id` only, or nested `skill.id`),
  `validate_provides_entry(entry)`, `extract_provides(doc)`.
- `registry.py` — `CapabilityRegistry`: `register_contract(doc)`, `providers_of(id)`,
  `is_collision(id)`, `collisions()`, `resolve(id, explicit_skill_id=, default_skill_id=)`
  (raises `CollisionError` — registry refusal — only when neither an explicit nor a
  default choice was given for an id with 2+ independent Providers).
- `conformance.py` — the eight checks from `docs/SKILL_SPEC.md` section 8. Three
  (`publishes_contract`, `lifecycle_declared`, `dependency_version_ranges`) are real,
  answerable from a contract document alone. The other five need a running Skill
  process; each is a documented stub that raises `NotImplementedError` naming exactly
  what per-Skill wiring it needs, rather than reporting an unearned pass.
- `tests/` — 21 tests against real captured `provides` data (`tests/fixtures/`, trimmed
  excerpts of `qc-skill`, `media-analysis-skill`, `video-editing-skill`,
  `transcription-skill` and `ffmpeg-skill`'s actual `contract`/`skill --json` output
  after their `provides` field was added — see `docs/ECOSYSTEM_CHANGELOG.md`), including
  the ecosystem's one real documented collision
  (`measure.audio.loudness`/`measure.audio.silence`/`measure.audio.integrity` between
  `qc-skill` and `media-analysis-skill`).

## What this deliberately is not

- **Not a live registry.** No process execution, no network, no persistence. A caller
  (an Agent, a future CLI) is responsible for fetching each Skill's `contract --json`
  output and calling `register_contract()` with it.
- **Not the full aspirational `CapabilityContract` shape.** `docs/SPEC.md` section 1
  sketches a much richer per-capability shape (`input_schema`, `output_schema`,
  `input_artifact_types`, `security.forbidden_keys`, ...). No Skill in the ecosystem
  publishes that shape today — only `{id, lifecycle, tool_id}` plus a few Skill-specific
  extra fields (`operation`, `element_type`, `kind`, `checks`). Validating against the
  richer shape here would reject every real contract in the ecosystem, so this library
  validates only what is actually real (**EXPERIMENTAL**, matching every Capability's own
  published lifecycle). The richer shape stays **VISION** until a Skill actually
  publishes it.
- **Not Phase 3.** This library can *apply* an explicit or default-provider choice once
  one is given; deciding what a deployment's default-provider policy should be, and
  where it is configured, is `docs/ROADMAP.md` Phase 3's job, not this library's.
- **Not the full conformance harness.** Five of the eight `SKILL_SPEC.md` checks need a
  live Skill process; wiring a real runner per Skill (or a generic one, if the
  invocation-mechanics diversity noted in `SKILL_SPEC.md` section 5 turns out to allow
  one) is future work.

## Why it lives here, not a new repository

This is reference/library code for the OS's own kernel concept, not a Skill and not a
distributable package yet — it belongs beside the architecture docs it implements until
there is a real consumer (an Agent, or a published package) that needs it standalone.
