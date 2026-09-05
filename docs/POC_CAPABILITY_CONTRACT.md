# PoC: Does the Capability Contract model actually work against real data?

Status: **completed proof-of-concept, three rounds — all 10 Skills in the ecosystem now
checked against real contract data.** First piece of this project's work checked
against live code rather than only against static repository reading. Round 1 checked
the known collision case (`qc-skill`/`media-analysis-skill`); Round 2 checked three
more, non-colliding Skills to isolate what actually drives Phase 2 retrofit cost; Round
3 completed the remaining five (`ffmpeg-skill`, `color-grading-skill`,
`motion-graphics-skill`, `subtitle-skill`, `thumbnail-skill`) for a full ecosystem-wide
picture. Per
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

## Round 2 — does the mapping cost (Finding 3) depend on collision, or something else?

Following this PoC's own recommendation, three more real Skills with **no capability
overlap with each other or with qc-skill/media-analysis-skill** were pulled the same
way — real, unmodified `contract --json` (`transcription-skill`: `skill --json`, its
own real subcommand name) — and added to
[`poc/capability-contract/`](../poc/capability-contract/):
[`video-editing-skill.contract.json`](../poc/capability-contract/video-editing-skill.contract.json),
[`audio-production-skill.contract.json`](../poc/capability-contract/audio-production-skill.contract.json),
[`transcription-skill.contract.json`](../poc/capability-contract/transcription-skill.contract.json).

**Finding 4 — mapping cost tracks contract richness, not collision.** This is the
answer to the open question Round 1 ended on, and it is more specific and more useful
than "yes, easier" or "no, the same":

- `video-editing-skill`'s own contract already carries a **native, per-operation
  `capability` field**, in exactly the dotted-namespace shape this project proposed —
  `TRIM → "video.trim"`, `CONCAT → "video.concat"`, `OVERLAY → "video.overlay"`, all 8
  operations. Extracting an OS-level Capability id from this Skill's real contract
  today requires **zero human judgment** — `registry_demo.py`'s Round 2 output reads
  the field directly. (One correction to this project's own prior work: the worked
  example in `CAPABILITY_MODEL.md` guessed the id `edit.trim`; the real Skill already
  publishes `video.trim`. The real Skill's own naming should win — noted here, not yet
  propagated back into `CAPABILITY_MODEL.md`'s prose, which is a small follow-up.)
- `audio-production-skill`'s contract has a `type` (`NORMALIZE`, `GAIN`, `MIX`, ...) and
  a `tool` (`ffmpeg-skill/loudness`, ...) per operation, but **no native Capability id
  field** — a human still has to decide `NORMALIZE` means `audio.normalize.loudness`.
  This Skill has zero collision with anything else in the ecosystem, and still needs
  the same manual step qc-skill/media-analysis-skill needed.
- `transcription-skill`'s contract has a flat, skill-wide `capabilities` list
  (`speech_recognition`, `word_timestamps`, `transcript_export:json`, ...) — closer in
  *spirit* to an OS Capability than qc-skill's/media-analysis-skill's environment-flag
  usage of the same word, but not itemized per typed operation, so it still needs a
  human decision, just a smaller one (mapping ~1 ability name, not N per-operation
  identifiers).

**Conclusion: whether a Skill needs manual Capability-id mapping in its Phase 2
retrofit has nothing to do with whether it collides with another Skill.** It depends
entirely on whether that Skill's own contract generator happens to already emit a
capability-shaped identifier per operation. Of the five Skills checked, one
(`video-editing-skill`) needs none; four need a bounded, per-operation human decision
regardless of collision status. This should be read directly into `ROADMAP.md` Phase
2's per-Skill scoping: it is not one uniform task repeated ten times, it ranges from
"add one top-level field, mechanically" to "make N small naming decisions," and which
case a given Skill falls into is now a knowable, checkable fact rather than an
assumption — check each Skill's real contract for a native capability-shaped field
before estimating its Phase 2 effort.

**Finding 5 — the Skill's own identifier field name is not even consistent.**
`qc-skill`, `media-analysis-skill`, `video-editing-skill`, and `audio-production-skill`
all self-report as `"skill_id": "..."`. `transcription-skill` instead uses
`"id": "transcription-skill"` — no `skill_id` field exists in its contract at all. This
is the same class of finding as Finding 1 (`skill_version` vs. `version`): `SPEC.md`
assumed a field name because 4 of 5 checked Skills agreed, and the 5th disagreed. Noted
directly in `SPEC.md` §1 rather than silently generalized away; **not yet fixed**,
because unlike Findings 1–3 this one doesn't have an obviously-correct resolution yet —
`transcription-skill` may be the outlier worth asking to change, or `id` may turn out to
be at least as common once more Skills are checked. Left as an open, named question
rather than a snap decision.

## Round 3 — the remaining five Skills, and the full ecosystem-wide picture

`ffmpeg-skill`, `color-grading-skill`, `motion-graphics-skill`, `subtitle-skill`, and
`thumbnail-skill` were captured the same way (`color-grading` / `motion-graphics` /
`thumbnail` via their real `contract --json`; `ffmpeg-skill` via its real
`scripts/_contract.py --json` generator, since it is Node-wrapped rather than a Python
console script; `thumbnail-skill` required installing its one real dependency,
`Pillow`, to import at all — done, not worked around). All ten Skills' real contracts
now live in [`poc/capability-contract/`](../poc/capability-contract/).

**Finding 6 — `contract_version` is rare, not just inconsistent.** Only 3 of 10 Skills
publish it at all: `qc-skill` (`1`, an int), `ffmpeg-skill` (`"1.0"`, a string),
`subtitle-skill` (`"1.0.0"`, a three-part string). Round 1 called this "not
consistently present"; with all 10 checked, the more accurate statement is that
**most Skills don't publish this field yet, at all** — this is a bigger gap than Round
1's framing suggested, and belongs explicitly in every remaining Skill's Phase 2 scope,
not treated as a minor cleanup.

**Finding 7 — `ffmpeg-skill` itself, the literal source `SPEC.md` §1 was generalized
from, does not match the flat shape `SPEC.md` proposed.** Its real top-level contract
nests `skill_id` and `version` inside a `skill: {id, version, description,
entrypoints, ...}` sub-object, with `contract_version` and `tools` as top-level
siblings — not the flat `skill_id`/`version`/`contract_version`/`provides` shape
`SPEC.md` describes. This matters because `SPEC.md` §1 explicitly claims to generalize
"`ffmpeg-skill`'s `ToolSpec`... into one cross-ecosystem shape" — that claim was true in
*spirit* (the same information exists) but not in literal structure. Recorded here
rather than silently smoothed over; `SPEC.md`'s flat shape is still a reasonable target
to converge *toward*, but no existing Skill, including the one it was modeled on,
already matches it exactly.

**Finding 8 — the ecosystem already has a common per-operation identifier convention,
and it is not the one `CAPABILITY_MODEL.md` proposed.** Across all 10 Skills:

| Convention | Shape | Skills that already have it natively |
|---|---|---|
| **Tool id** (`<skill>/<tool>`) | one id per concrete, invokable operation, namespaced by Skill | `ffmpeg-skill` (`ffmpeg-skill/audio`), `media-analysis-skill` (`media-analysis/loudness`), `thumbnail-skill` (`thumbnail/render`) — 3 Skills |
| **Capability id** (`<domain>.<verb>`) | cross-Skill, groups equivalent operations from *different* Skills under one name | `video-editing-skill` only (`video.trim`) — 1 Skill |
| **Neither, one generic tool per Skill** | a single `<skill>/run` tool id; real operations are `type`-tagged entries in a separate `operations` list one level deeper, not independently addressable | `audio-production-skill`, `color-grading-skill`, `motion-graphics-skill` — 3 Skills |
| **Neither, no tools array at all** | operations named directly (`generate`, `render`) with no id field | `subtitle-skill` — 1 Skill |
| **Neither, checks are dotted but skill-internal** | e.g. `audio.integrated_loudness_within_tolerance` — namespaced like a Capability id, but never intended to match another Skill's check of the same name | `qc-skill` — 1 Skill |
| **`id`-only, flat skill-wide list, no per-operation structure** | | `transcription-skill` — 1 Skill |

This re-centers what Phase 2 actually needs to produce, ecosystem-wide: **the Tool id
convention (`<skill>/<tool>`) is already the closer-to-universal one** (3 Skills have it
natively, and `qc-skill`'s/`media-analysis-skill`'s own check/tool names are a short
step from it) — it identifies *one Skill's one operation*. What's almost entirely
missing (video-editing-skill is the sole exception) is the **cross-Skill grouping
label** — the actual `CAPABILITY_MODEL.md` "Capability id" — that lets a Plan say
"I need `measure.audio.loudness`" without caring whether `qc-skill`'s
`audio.integrated_loudness_within_tolerance` or `media-analysis-skill`'s
`media-analysis/loudness` answers it. Phase 2's real, central task is adding that
grouping label on top of identifiers that mostly already exist — not inventing
per-operation identifiers from nothing.

**Finding 9 — `skill_id` is the dominant, safe convention; `transcription-skill` is the
outlier.** With all 10 checked (`ffmpeg-skill`'s nested shape counted separately): 8 of
9 flat-shaped Skills publish `skill_id`; 4 of those 8 (`audio-production-skill`,
`color-grading-skill`, `motion-graphics-skill`, `thumbnail-skill`) *also* publish a
redundant `id` field with the same value, for no evidenced reason; only
`transcription-skill` publishes `id` and no `skill_id` at all. This resolves Round 1's
open question with real confidence: `SPEC.md`'s `skill_id` field name is correct as
written, and `transcription-skill`'s divergence is the one Skill worth flagging for a
future, low-priority fix on its own side — not a reason to change `SPEC.md`.

## What this PoC does not prove

- It does not prove the *full* Phase 1 registry (dynamic discovery, multiple Skills,
  real Plan validation, actual runtime enforcement) works — only that the specific
  collision-resolution logic does, in isolation, against two real Skills' real data,
  and that all 10 Skills' contract shapes were checked field-by-field against the
  proposed schema and against each other.
- It does not touch `video-production-agent`'s actual `SkillRegistry` code at all — a
  faithful next step would be replacing its hardcoded ordered-candidate-list
  (`silence_cleanup` → `["ffmpeg-skill/cut", "video-editing/cut"]`, per
  `REPOSITORY_MAP.md`) with something backed by this registry model, which this PoC
  does not attempt.
- `motion-graphics-skill`'s per-element structure (`element_types`,
  `unsupported_element_types`, `animations`) was not decomposed in the same depth as
  the other Skills' `operations`/`tools` — it has no `operations` key at all, and
  fully mapping its identifier shape is left for whoever does its actual Phase 2 work.

## Recommendation

1. Apply the field-naming corrections above to `SPEC.md` §1 — done for Findings 1–3;
   Finding 5/9 resolved `skill_id` as correct-as-written; Finding 7 (`ffmpeg-skill`'s
   real nested shape) is recorded here as a known, accepted gap between the proposed
   target shape and every existing Skill including its own model, not fixed by forcing
   `ffmpeg-skill` to change or by further loosening `SPEC.md`.
2. Treat "does this Skill already have a native capability-shaped field, a Tool id, a
   single generic tool, or neither" as a per-Skill fact to check before scoping its
   `ROADMAP.md` Phase 2 entry — Findings 4 and 8 show this varies by Skill and changes
   the effort by more than a little.
3. Scope Phase 2's actual work correctly given Finding 8: for most Skills the task is
   *not* "invent identifiers from nothing," it is "add the cross-Skill Capability
   grouping label on top of Tool ids/check names that mostly already exist." This is a
   smaller, better-defined task than "publish a full CapabilityContract" made it sound
   before this PoC.
4. This PoC's evidence-gathering purpose is now complete — all 10 Skills checked, at
   low cost (roughly a day's work total across three rounds, zero new repositories, zero
   Skill retrofits, zero synthetic examples). The next step that would cost
   meaningfully more than this is either (a) building a real, minimal registry
   implementation against this now-verified understanding, or (b) actually touching
   `video-production-agent`'s `SkillRegistry` — both are Phase 1/3 work, not further
   PoC work, and should be scoped and decided on their own terms rather than treated as
   "more of the same cheap investigation."
