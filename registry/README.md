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
- `capability_contract.schema.json` / `schema.py` — the full aspirational
  `CapabilityContract` shape `docs/SPEC.md` section 1 sketches, formalized as an actual
  JSON Schema (draft 2020-12) document (`docs/ROADMAP.md` Phase 1, item 1). `required` is
  deliberately narrow — only a skill identity plus `provides[].{id, lifecycle, tool_id}`,
  the subset every real Skill's `contract` output already carries — so it documents the
  richer per-Capability shape (`input_schema`, `security.forbidden_keys`, ...) in full
  while still validating today's real, minimal contracts. `load_schema()` is stdlib-only;
  see "What this deliberately is not" below for why nothing here validates a document
  against it at runtime.
- `registry.py` — `CapabilityRegistry`: `register_contract(doc)`, `providers_of(id)`,
  `is_collision(id)`, `collisions()`, `resolve(id, explicit_skill_id=, default_skill_id=)`
  (raises `CollisionError` — registry refusal — only when neither an explicit nor a
  default choice was given for an id with 2+ independent Providers).
- `conformance.py` — **all eight** checks from `docs/SKILL_SPEC.md` section 8 are now
  real. Three (`publishes_contract`, `lifecycle_declared`, `dependency_version_ranges`)
  are answerable from a contract document alone. Four more (`forbidden_keys_rejected`,
  `doctor_status`, `workspace_confinement`, `no_clobber_input`) are real when given
  callables that talk to a live Skill process — `make_stdin_json_runner()` builds one
  for the ecosystem's common "one JSON request on stdin, one JSON response on stdout"
  CLI convention, verified end-to-end against a real `qc-skill` process
  (`tests/test_conformance_live.py`, skipped when `qc` isn't on `PATH`).
  `workspace_confinement` and `no_clobber_input` turned out not to fit the "submit a bad
  output path, check it's rejected" shape the other two use: live testing found
  `qc-skill`'s `run` request schema has no output-path field at all (its operations are
  read-only measurement; its report cache writes to a fixed, non-request-controlled
  path). They're instead observational — snapshot directories outside the workspace
  before/after a real run (`workspace_confinement`), or hash the input fixture
  before/after (`no_clobber_input`) — properties that hold for any Skill regardless of
  whether it exposes an output-path field. The eighth (`no_unsafe_shell_out`) is real
  when given a Skill's own Python package root: it statically AST-walks the source tree
  (SKILL_SPEC.md section 4.3's pattern) for `eval`/`exec`, `os.system`/`os.popen`, a
  string/f-string first argument to `subprocess.{run,Popen,call,check_call,
  check_output}`, or a `shell=` keyword that isn't the literal, safe `False` — deliberately
  AST-based rather than text/regex, since an earlier draft's regex scan produced two real
  false positives against the ecosystem's actual source (a comment merely *mentioning*
  "eval()/exec()" in `qc-skill`, and the safe, explicit `shell=False` several Skills
  actually use). Manually verified PASS against all 9 real Python Skills' source trees;
  does not cover `ffmpeg-skill` (Node.js, not Python — a language-appropriate lint-rule
  equivalent is future work).
- `tests/` — 62 tests: 21 against real captured `provides` data (`tests/fixtures/`,
  trimmed excerpts of `qc-skill`, `media-analysis-skill`, `video-editing-skill`,
  `transcription-skill` and `ffmpeg-skill`'s actual `contract`/`skill --json` output
  after their `provides` field was added — see `docs/ECOSYSTEM_CHANGELOG.md`), including
  the ecosystem's one real documented collision
  (`measure.audio.loudness`/`measure.audio.silence`/`measure.audio.integrity` between
  `qc-skill` and `media-analysis-skill`); 11 more (`tests/test_conformance_live.py`) run
  all four live conformance checks against a real `qc-skill` process, each paired with a
  synthetic sanity check proving it can actually FAIL (not just always PASS); 18 more
  (`tests/test_no_unsafe_shell_out.py`) exercise the AST-walk check's logic against
  synthetic fixtures — every real unsafe pattern, plus regression tests for the two
  false positives found against real ecosystem source; 12 more (`tests/test_schema.py`)
  cover `capability_contract.schema.json` — always: the file is valid JSON and
  `load_schema()` reads it; skipped when the optional `jsonschema` package is absent:
  the schema is itself a valid draft 2020-12 document, every real fixture in
  `tests/fixtures/` validates against it (all three skill-identity shapes included), and
  it actually rejects broken documents (a missing identity, a missing/invalid
  `lifecycle`, a missing `tool_id`) rather than accepting anything handed to it.

## What this deliberately is not

- **Not a live registry.** No process execution, no network, no persistence. A caller
  (an Agent, a future CLI) is responsible for fetching each Skill's `contract --json`
  output and calling `register_contract()` with it.
- **Not runtime validation against the full aspirational shape.** `docs/SPEC.md` section 1
  sketches a much richer per-capability shape (`input_schema`, `output_schema`,
  `input_artifact_types`, `security.forbidden_keys`, ...), now formally documented in
  `capability_contract.schema.json`. No Skill in the ecosystem publishes that richer shape
  today — only `{id, lifecycle, tool_id}` plus a few Skill-specific extra fields
  (`operation`, `element_type`, `kind`, `checks`). `contract.py`'s own Python-level
  validation still checks only what is actually real (**EXPERIMENTAL**, matching every
  Capability's own published lifecycle) — the richer fields stay **VISION** until a Skill
  actually publishes them, at which point the schema already describes the shape they'd
  need to match.
- **Not Phase 3.** This library can *apply* an explicit or default-provider choice once
  one is given; deciding what a deployment's default-provider policy should be, and
  where it is configured, is `docs/ROADMAP.md` Phase 3's job, not this library's.
- **Not a CI-integrated harness yet.** All eight `SKILL_SPEC.md` §8 checks are real
  functions a caller can invoke, but nothing here runs them automatically against every
  Skill on a schedule or in a shared CI job — a caller (a future CLI, or each Skill's own
  CI) still wires them in per-Skill. `no_unsafe_shell_out` also has no non-Python
  equivalent yet, so `ffmpeg-skill` (Node.js) is not covered by any check in this file.

## Why it lives here, not a new repository

This is reference/library code for the OS's own kernel concept, not a Skill and not a
distributable package yet — it belongs beside the architecture docs it implements until
there is a real consumer (an Agent, or a published package) that needs it standalone.
