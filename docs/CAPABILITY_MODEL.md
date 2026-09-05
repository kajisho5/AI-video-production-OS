# Capability Model: Capability vs Skill vs Provider vs Runtime

This is the single most consequential decision in this architecture, per the task
brief's own framing. It is derived from `REPOSITORY_MAP.md` evidence, not designed in
the abstract, and it is designed specifically to fix one real problem found during the
audit: `qc-skill` and `media-analysis-skill` independently implement loudness, silence,
and decode-integrity measurement with no shared identity between them, and no mechanism
exists today for the ecosystem to even notice this is duplication rather than divergent
design.

## The four concepts, restated precisely

| Concept | Question it answers | Example | Owned by |
|---|---|---|---|
| **Capability** | "What can be accomplished?" | `measure.audio.loudness` | OS registry (declared by Skills) |
| **Provider** | "Which implementation does it?" | `qc-skill`'s loudness measurement | A Skill, registered against a Capability id |
| **Skill** | "What package ships the code?" | `qc-skill` (the repo) | Independent authors/repos |
| **Runtime** | "How does it actually execute?" | subprocess isolation, path policy, timeouts | OS reference library + conformance tests |

A single Skill package is typically a Provider of several Capabilities (e.g.
`ffmpeg-skill` provides `edit.cut`, `edit.join`, `audio.mix`, `graphics.overlay`,
`caption.burn-in`, ... — 21 tool scripts, several Capabilities each). A single Capability
can have zero, one, or several Providers.

## Worked examples, grounded in what actually exists

- **Capability `edit.trim`** → Provider: `video-editing-skill`'s `TRIM` operation, which
  itself executes via the Runtime against `ffmpeg-skill`'s `cut` tool. Three layers,
  three different repos, exactly as they exist today — this model does not change any of
  it, it names what is already there.
- **Capability `color.hdr-to-sdr`** → Provider: `color-grading-skill`'s `HDR_TO_SDR`
  operation, itself executing `ffmpeg-skill`'s `color` tool. Same three-layer shape.
- **Capability `measure.audio.loudness`** → **two** Providers today, unregistered as
  such: `qc-skill` (`measurements/audio.py`, `ebur128`) and `media-analysis-skill`
  (`analyzers/loudness.py`, also `ebur128`, independently parsed). Under this model both
  register against the same Capability id. The registry now has a fact it can act on —
  today it has silent duplication instead.
- **Capability `measure.video.freeze`** → **one** Provider (`qc-skill`'s
  `freezedetect`-based check). `media-analysis-skill` does not implement this at all —
  confirmed absent, not a second silent duplicate.
- **Capability `subtitle.generate`** → Provider: `subtitle-skill`'s `generate` operation.
  Note this Capability does **not** include transcription — `subtitle-skill` consumes an
  already-built `SubtitleDocument`. Transcription is a separate Capability,
  `transcribe.audio`, provided by `transcription-skill`. Composing the two is a Plan
  concern (two Operations, one DAG edge), not a Skill-to-Skill dependency — exactly how
  the ecosystem already keeps them apart today.

## Capability collision policy

When two or more Skills register as Providers of the same Capability id, the OS **must
not** pick silently. Three explicit resolution mechanisms, in order of precedence:

1. **Plan-time explicit choice** — a `ProductionPlan`'s Operation names the Provider it
   wants (`provider: qc-skill`), recorded in provenance. Always wins if present.
2. **Default-provider policy** — an OS-level or Workspace-level config file (analogous
   in spirit to `ffmpeg-skill`'s `doctor` capability report) states a default Provider
   per Capability id, used when the Plan doesn't specify one.
3. **Capability registry refusal** — if neither exists and more than one Provider is
   AVAILABLE, plan validation (`EXECUTION_MODEL.md`) fails loudly rather than picking
   arbitrarily. This is stricter than what exists today (`SkillRegistry.select_tool()`
   currently picks the first candidate in a hardcoded ordered list — a silent default
   this OS replaces with an explicit, provenance-recorded choice).

This directly satisfies task Rule 9 (no abstraction without concrete value — this one
fixes a real, already-occurred bug class) and Rule 16 (composability over hard-coded
pipelines — the ordered-candidate-list pattern in `SkillRegistry` is exactly the
hard-coding this replaces).

## Granularity: what deserves to be a new Skill

Criteria, derived from what already earned Skill-hood in the ecosystem vs. what stayed
inside an existing Skill (e.g. color-grading-skill's typed operations vs. its explicitly
refused creative-grading operations):

**Deserves a new Skill when it has *all* of:**
1. A domain of judgment/parameters that doesn't reduce to typed operations another Skill
   already exposes (e.g. `dubbing-skill` would own voice-timing/lip-sync tradeoffs that
   don't fit inside `audio-production-skill`'s typed operation set).
2. A security/execution boundary worth isolating on its own release cadence (calls its
   own external tool/binary/API, needs its own dependency and permission surface).
3. Independently testable and versionable without forcing a release of an unrelated
   Skill.
4. More than a thin wrapper — if 90% of the logic is "call another Skill with different
   default parameters," it is not a new Skill (see `motion-graphics-skill`, which is a
   real Skill because it owns overlay-composition judgment, not merely different ffmpeg
   flags).

**Should remain a Capability**, not a new Skill: any single accomplishable thing,
regardless of which Skill provides it — this is the entire point of separating the two
concepts.

**Should remain a Runtime primitive**, not a Skill: process execution, path policy,
the `FORBIDDEN_KEYS` contract, contract-schema format — cross-cutting infrastructure
every Skill needs identically, not something a Plan ever selects.

**Should remain an Operation** (a parameter set within an existing Capability), not a
new Capability: a variant of something a Capability already does (e.g. "silence-based
trim" vs. "explicit-range trim" are two Operations of `edit.trim`-adjacent Capabilities,
not two Capabilities).

**Should be a Provider**, not a new Skill: a different backend for a Capability that
already exists (e.g. a future cloud-ASR Provider of `transcribe.audio` alongside
`transcription-skill`'s local `faster-whisper` — this is exactly the shape
`transcription-skill`'s own internal `engines/registry.py` already uses one level down,
lifted to the OS level).

**Should be a library**, not a Skill: shared code with no independent process/execution
footprint — the `PathPolicy`/`FORBIDDEN_KEYS` pattern reimplemented near-identically in
at least seven repos is exactly this case; it should be one OS-provided reference
library (and a conformance test suite for non-Python Skills), not eight copies.

## Avoiding both failure modes

**Skill explosion** (Rule against): a proposal for `voice-production-skill`,
`dubbing-skill`, and `localization-skill` as three *separate* Skills should be
challenged first against the criteria above — if all three would delegate 100% of
execution to `ffmpeg-skill`/`transcription-skill` and differ only in default parameter
sets, they may be three Capabilities within one `localization-skill`, not three Skills.
This is a judgment call for `SKILL_PROPOSAL.md`'s review process, not a rule this
document can fully automate.

**Monolithic skill** (Rule against): `ffmpeg-skill` itself is the closest thing to a
"do everything" skill in the ecosystem (21 tools), and it earns that breadth precisely
because every tool shares one execution boundary (the ffmpeg/ffprobe binary) and one
security model — the criterion is shared *execution substrate*, not domain breadth. A
future `video-skill` that bundled editing + color + subtitles + motion graphics under one
package would fail this test, because those domains already have independent typed
parameter models, independent security reviews, and independently useful release
cadences in the current ecosystem (5 separate repos, all delegating to the *same*
`ffmpeg-skill`, which is the correct place for the shared substrate to live).

## Capability lifecycle

Independent of a Skill's own release version (see `VERSIONING.md`), each Capability
carries a lifecycle state: `PROPOSED → EXPERIMENTAL → STABLE → DEPRECATED → RETIRED`.
This is deliberately **shorter** than the task brief's suggested seven-state list
(`PROPOSED/EXPERIMENTAL/ALPHA/BETA/STABLE/DEPRECATED/RETIRED`) — the audit found no
evidence any existing Skill distinguishes ALPHA from BETA from EXPERIMENTAL in practice
(every Skill is simply version `0.x`, informally pre-1.0), so a five-state model that
maps onto what Skill authors already do (a Capability is either still-forming, usable
but not promised-stable, promised-stable, on its way out, or gone) is preferred over
inventing granularity nobody currently uses. See `SKILL_SPEC.md`.
