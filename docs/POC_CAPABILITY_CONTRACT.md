# PoC: Does the Capability Contract model actually work against real data?

Status: **completed proof-of-concept**, first piece of this project's work checked
against live code rather than only against static repository reading. Per
[`docs/FINAL_REVIEW.md`](FINAL_REVIEW.md) §3, the single biggest open risk in the
architecture was that nobody had ever exercised the Capability/Provider model against
real contract data — only read it in source. This PoC closes that specific gap, in the
smallest way that could produce a real answer: no new repository, no retrofit of any
Skill, no synthetic examples.

Artifacts: [`poc/capability-contract/`](../poc/capability-contract/) — real command
output, a schema, a zero-dependency validator, and a registry/collision-resolution
demo, all runnable and re-checkable by anyone.

## Method

1. Ran the **real, unmodified** `contract --json` CLI command against the local clones
   of `qc-skill` and `media-analysis-skill` (`PYTHONPATH=src python3 -m
   <package>.cli contract --json`) and saved the output verbatim:
   [`qc-skill.contract.json`](../poc/capability-contract/qc-skill.contract.json),
   [`media-analysis-skill.contract.json`](../poc/capability-contract/media-analysis-skill.contract.json).
   Both runs exited 0 with empty stderr.
2. Transcribed [`docs/SPEC.md`](SPEC.md) §1's proposed `CapabilityContract` shape
   verbatim into a real, checkable [`schema.json`](../poc/capability-contract/schema.json).
3. Wrote a small, zero-dependency validator
   ([`validate.py`](../poc/capability-contract/validate.py) — no `jsonschema` package
   available in this environment, and every audited Skill already ships its own
   hand-rolled subset validator for the same reason, so this matches ecosystem
   convention rather than adding a new dependency) and ran it against both real files.
4. Manually mapped each Skill's real, existing check/tool identifiers onto the OS-level
   Capability ids `CAPABILITY_MODEL.md` already uses as worked examples
   (`measure.audio.loudness`, `measure.audio.silence`, `measure.video.integrity`,
   `measure.video.freeze`, `measure.video.scene_detection`), confirmed each mapping
   against the real JSON (not assumed), and ran a real,
   ~100-line [`registry_demo.py`](../poc/capability-contract/registry_demo.py)
   implementing `CAPABILITY_MODEL.md`'s three-tier collision policy literally, then
   exercised it against five scenarios.

## Finding 1 — the core architectural bet holds

Confirmed with real data, not narrative:

- Both Skills really do have independent, working measurement logic for loudness,
  silence, and integrity (`qc-skill`'s `checks` list and `media-analysis-skill`'s
  `tools` list both contain them, verified by set membership against the actual JSON,
  not assumed from prose).
- Both real absences hold: `qc-skill` has no scene-detection check;
  `media-analysis-skill` has no freeze-frame tool. Confirmed by direct query, not
  citation — this is not a strict subset relationship, exactly as
  `CAPABILITY_MODEL.md` claims.
- The three-tier collision policy, implemented as ordinary Python with no new
  infrastructure, correctly: refuses to pick silently when two Providers are
  registered and neither an explicit choice nor a default policy exists; honors an
  explicit Plan-time choice; honors a default-provider policy; resolves trivially when
  only one Provider exists; and errors clearly when an explicit choice names a Provider
  that was never registered. All five scenarios ran and produced the expected result on
  the first try.

**Verdict: the Capability/Skill/Provider split and its collision-resolution policy is
not just a nice diagram — a real, minimal implementation of it, pointed at real Skill
data, does what `CAPABILITY_MODEL.md` says it should.**

## Finding 2 — SPEC.md's proposed field shapes do not match reality, and should change

This is exactly the kind of thing a PoC is supposed to surface before Phase 1 code gets
built around an unverified shape. Running the validator produced:

```
=== qc-skill.contract.json ===
  - MISSING required field: 'skill_version'
  - WRONG TYPE for 'capabilities': expected list, got dict (value: <dict of len 2>)

=== media-analysis-skill.contract.json ===
  - MISSING required field: 'skill_version'
  - MISSING required field: 'contract_version'
  - capabilities[0]: expected an object with an 'id' field, got str: 'ffprobe'
```

Three concrete, actionable mismatches:

1. **`skill_version` should be `version`.** Neither real Skill uses `skill_version` —
   both use a plain `version` field (`qc-skill`: `"version": "0.1.0"`;
   `media-analysis-skill`: `"version": "0.1.0"`). `SPEC.md` invented a more
   OS-flavored name instead of using what the ecosystem already, consistently calls it.
   **Fix: rename `CapabilityContract.skill_version` to `version` in `SPEC.md`.**

2. **The word "capabilities" already means something else, and it means it two
   different ways.** `qc-skill`'s `capabilities` field is
   `{"required": ["ffprobe"], "optional": ["ffmpeg", "filter:blackdetect", ...]}` —
   environment/binary feature detection (does this machine have `ffprobe`, does this
   `ffmpeg` build have the `blackdetect` filter). `media-analysis-skill`'s
   `capabilities` field is a flat list of the same kind of thing
   (`["ffprobe"]`, with a *second*, separately-named field `capability_names` for the
   full list). **Neither Skill uses "capabilities" to mean an OS-level accomplishable
   unit of work** (this project's `CAPABILITY_MODEL.md` sense, e.g.
   `measure.audio.loudness`) — that concept doesn't exist in either Skill's contract
   today at all, under any name. Reusing "capabilities" for the OS-level list in
   `SPEC.md` creates a genuine naming collision with a meaning the ecosystem already
   uses, which is precisely the kind of ambiguity `CORE_PRIMITIVES.md` §2 already
   flagged as a real, found bug for the word "Skill" — this is the same bug shape,
   found in a different field. **Fix: rename `SPEC.md`'s OS-level list to `provides`
   (a Skill *provides* Capabilities; it separately *requires* environment
   capabilities) and leave each Skill's own existing `capabilities`
   required/optional environment-detection field alone, unrenamed, since it is
   already a real, working, differently-scoped concept.**

3. **`contract_version` is not consistently present, and where present is not
   consistently a string.** `qc-skill` has `"contract_version": 1` (a bare integer).
   `media-analysis-skill` has no top-level `contract_version` field at all — its
   version is embedded in a `"schema": "media-analysis/contract@1"` string instead.
   `SPEC.md` assumed a string like `"1.0"` (modeled on `ffmpeg-skill`'s convention,
   confirmed correct for that one Skill, but not universal). **Fix: `SPEC.md` should
   describe `contract_version` as "a scalar (string or integer) identifying the
   contract shape version, in whatever form the Skill already reports it" rather than
   mandating a string, and note that Skills which don't yet publish a
   distinct `contract_version` field (`media-analysis-skill`) will need to add
   one during their Phase 2 contract retrofit — this is now a known, specific,
   per-Skill task instead of an assumption.**

None of these three findings change the overall Capability/Skill/Provider model or the
kernel definition in `ARCHITECTURE.md` §8 — they are field-naming corrections to one
proposed schema, caught before any Skill was asked to implement it. This is exactly
what a cheap PoC is for.

## Finding 3 — mapping existing identifiers to Capability ids is a real, manual step today

`registry_demo.py`'s `CAPABILITY_TO_PROVIDERS` table (e.g. `measure.audio.loudness` →
`qc-skill`'s check `audio.integrated_loudness_within_tolerance` and
`media-analysis-skill`'s tool `media-analysis/loudness`) had to be written by hand,
because **nothing in either Skill's real, self-reported contract expresses this
correspondence today.** Both Skills describe their own checks/tools richly, but neither
knows the other exists, and neither speaks the OS-level Capability vocabulary. This
confirms, with direct evidence rather than inference, exactly the gap
`CAPABILITY_MODEL.md` was written to close — and clarifies that closing it is not free:
each Skill's Phase 2 contract retrofit (`ROADMAP.md`) will need to include a human (or
carefully-reviewed AI) decision about which Capability id(s) each of its existing
checks/tools should be registered under. This is a real, sizeable-but-bounded task, not
a mechanical one — worth calling out explicitly in `ROADMAP.md` Phase 2's scope, which
this PoC's findings should be read alongside.

## What this PoC does not prove

- It does not prove the *full* Phase 1 registry (dynamic discovery, multiple Skills,
  real Plan validation) works — only that the specific collision-resolution logic does,
  in isolation, against two real Skills' real data.
- It does not touch `video-production-agent`'s actual `SkillRegistry` code at all — a
  faithful next step would be replacing its hardcoded ordered-candidate-list
  (`silence_cleanup` → `["ffmpeg-skill/cut", "video-editing/cut"]`, per
  `REPOSITORY_MAP.md`) with something backed by this registry model, which this PoC
  does not attempt.
- It says nothing about the other 8 Skills' contract shapes — `qc-skill` and
  `media-analysis-skill` were chosen specifically because they are the known collision
  case; the other Skills' contracts may match `SPEC.md` more or less closely than these
  two did (recall `ffmpeg-skill`'s own contract already closely matches the *general
  shape* `SPEC.md` generalized from it, per `REPOSITORY_MAP.md` — it was not re-checked
  here since it was the direct source of the design, not an independent check).

## Recommendation

1. Apply the three field-naming corrections above to `SPEC.md` §1 now — cheap, and
   this is exactly the point where doing it costs a documentation edit instead of a
   breaking schema change after Phase 1 code exists. (Done — see the amendment to
   `SPEC.md` this PoC's findings are attached to.)
2. Treat "map this Skill's existing identifiers onto Capability ids" as an explicit,
   named line item in each Skill's `ROADMAP.md` Phase 2 entry, not an assumed
   side-effect of "publish a contract."
3. Do not yet build the full Phase 1 registry library. This PoC validated the model at
   the smallest scale that could falsify it; the next-smallest useful step is doing the
   same exercise against one or two *more* Skills (ideally ones with less contract
   overlap than qc-skill/media-analysis-skill, to see whether the mapping step gets
   easier or harder at the "no collision" end of the spectrum) before committing to a
   registry implementation shape.
