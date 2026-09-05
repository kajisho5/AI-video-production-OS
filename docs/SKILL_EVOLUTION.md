# Skill Evolution Matrix

Status tags used throughout, matching every other document in this project: **CURRENT**
(verified in the audited repos today), **FUTURE** (proposed, not implemented anywhere
yet), **EXPERIMENTAL** (exists but unstable/stubbed/provisional), **UNKNOWN** (could not
be determined from available evidence).

This is a **per-repository evolution matrix** — one row per repo, tracking how each of
the 11 real repositories found in `REPOSITORY_MAP.md`'s audit moves from its current
shape toward publishing a conformant `CapabilityContract` (`SPEC.md` §1, `SKILL_SPEC.md`)
under this OS architecture. It is a different axis from `CAPABILITY_MATRIX.md`, which
tables capability-id-to-Provider mappings; this document does not repeat that table's
content, only cites specific capability ids from it where a row needs them.

Every claim below is grounded in `REPOSITORY_MAP.md`, `CORE_PRIMITIVES.md`,
`CAPABILITY_MODEL.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CAPABILITY_MATRIX.md`,
`DEPENDENCY_GRAPH.md`, and, where a column requires a shape only defined there,
`SPEC.md`, `SKILL_SPEC.md`, `VERSIONING.md`, `PROVENANCE.md`, and `SECURITY_MODEL.md`.
Where evidence is genuinely absent rather than negative, this document says `UNKNOWN`
rather than inventing a gap or a removal to fill a column.

Each repo uses a consistent heading structure — the same 17 subsections in the same
order — rather than one wide table, because a table with this many columns across 11
repos would not be readable.

---

## ffmpeg-skill

### Current Role
The FFmpeg execution boundary — 21 typed, `argparse`-introspected Python-stdlib CLI
scripts; the ecosystem's foundational execution boundary that every delegating Skill
invokes as a subprocess; the only repo shipping an actual MCP server
(`REPOSITORY_MAP.md`).

### Current Capabilities
The 21 base-layer capability ids `ffmpeg-skill.<tool>` — `cut, fit, caption, overlay,
graphics, sync, multicam, audio, loudness, silence, join, color, export, check, scenes,
look, render, probe, batch, report, verify` (`CAPABILITY_MATRIX.md` §9).

### Target Role
**NO CHANGE.** `ARCHITECTURE.md` §8 explicitly keeps "FFmpeg, or any specific media
engine's implementation details" out of the OS kernel — ffmpeg-skill stays a Skill, the
most foundational one, not folded into the OS.

### Target Capabilities
None justified by evidence. The only genuinely useful additions are contract-shape
fields (see OS Interfaces) and closing the honest per-encode timeout gap
(`SECURITY_MODEL.md` §5) at the Runtime layer — neither is a new Capability id.

### Missing Capabilities
Self-declared `not_provided`: `AI reasoning, decisions, production plans, project IR,
approvals, network access, transcription engine` (`REPOSITORY_MAP.md`).

### Capabilities to Remove
None — the audit found zero evidence any current capability should be removed.

### Capabilities to Move
N/A — ffmpeg-skill is not party to the qc-skill/media-analysis-skill collision
(`CAPABILITY_MATRIX.md` §8a names only those two Skills).

### Dependencies
None. Zero Skill dependencies; stdlib plus the `ffmpeg`/`ffprobe` binaries only
(`DEPENDENCY_GRAPH.md` §1.1).

### OS Interfaces
Already the richest contract in the ecosystem (`scripts/_contract.py`, introspected live
from `argparse`) — the closest existing shape to `SPEC.md` §1's `CapabilityContract`. To
conform it must additively gain: `capabilities[].lifecycle` (doesn't exist anywhere yet,
per `CAPABILITY_MATRIX.md`), `security.forbidden_keys` per capability (`SPEC.md` §1,
PROPOSED), and the `input_artifact_types`/`output_artifact_types` generalization of its
existing inputs/outputs fields. `skill_id`, `skill_version`, `contract_version`, an empty
`dependencies: []` (correctly, since it has none), and `not_provided[]` are already
present.

### Agent Interfaces
**CURRENT:** one of `video-production-agent`'s manually-registered `Service.adapter()`
entries; also the only Skill with an actual MCP server (`mcp/server.py`), whose
`tools/list` is generated live from the same contract generator as the CLI
(`ARCHITECTURE.md` §5). **FUTURE (Phase 3-4, `ROADMAP.md`):** once `SkillRegistry`'s
hardcoded ordered candidate list is replaced with real Provider resolution,
ffmpeg-skill's 21 base-layer capabilities become directly resolvable registry entries
rather than only reachable through a hand-edited adapter table — but because ffmpeg-skill
is typically the sole Provider of its own base-layer capability ids, it is largely
unaffected by Phase 3's collision-resolution mechanics themselves (that is
qc-skill/media-analysis-skill's concern).

### QC Interfaces
ffmpeg-skill's own `check`/`verify` tools are explicitly "not confirmed identical to
qc-skill's checks" (`CAPABILITY_MATRIX.md` §9) — qc-skill talks to `ffmpeg`/`ffprobe`
directly, not via ffmpeg-skill's tools. ffmpeg-skill's outputs (video/audio/image
artifacts from `cut`, `join`, `color`, etc.) are exactly the artifacts qc-skill and
media-analysis-skill verify, so ffmpeg-skill produces what QC checks without performing
QC itself.

### Provenance
**CURRENT, honest gap:** every run reports the exact ffmpeg command line(s) and an
output probe in its `--json` response, but nothing is persisted as a sidecar/manifest
next to the output (`REPOSITORY_MAP.md`; `PROVENANCE.md` §1). Against `PROVENANCE.md`
§2's minimum field list (source artifact hash, capability+provider id, skill id+version,
`contract_version`, effective parameters, plan/IR hash when Agent-orchestrated, tool
versions), ffmpeg-skill's response already carries most of this implicitly but persists
none of it when invoked outside the Agent. `PROVENANCE.md` §3's recommended fix — a
`--provenance-out` flag or a Runtime-layer auto-write of the sidecar — is the concrete
gap-closer, not a new storage paradigm.

### Security
Per `SECURITY_MODEL.md` §1, ffmpeg-skill is named among the repos where the convergent
5-primitive pattern was found (`shell=False`/list-argv confirmed via ecosystem-wide grep;
`mutates_input:false` enforced for every tool). The one honest, named gap: **no
per-encode wall-clock timeout on 20 of its 21 scripts** — only `verify.py` sets one
(`SECURITY_MODEL.md` §5, `REPOSITORY_MAP.md`). A `FORBIDDEN_KEYS`-style denylist is less
central here than for other Skills because ffmpeg-skill never accepts a caller-supplied
filter string in the first place — typed, range-checked flags are the primary defense
(`SECURITY_MODEL.md` §6).

### Versioning
`skill.version` 0.9.1; `contract_version` "1.0", frozen across the whole 0.8.3→0.9.1
span — `VERSIONING.md` §1's own worked example of the proven two-axis pattern. No
`contract_version` bump has ever occurred, so no Skill in the ecosystem has yet observed
the breaking-change mechanics of `VERSIONING.md` §3 in practice.

### Priority
Phase 2 (`ROADMAP.md`) — explicitly called "the easiest and lowest-risk retrofit"
because it is already schema-introspected.

### Migration Strategy
Publish CapabilityContract v1.0 (additive fields only), zero behavior change.

---

## video-editing-skill

### Current Role
Cut/trim/concat/resize editing Skill delegating to ffmpeg-skill (`REPOSITORY_MAP.md`).

### Current Capabilities
`edit.trim, edit.cut, edit.concat, edit.speed, edit.fit, edit.fill, edit.resize,
edit.overlay` (`CAPABILITY_MATRIX.md` §1).

### Target Role
**NO CHANGE.** Already the exemplary delegation pattern (`CORE_PRIMITIVES.md` §2,
`ARCHITECTURE.md` §7) that every future Skill should copy; it only needs to publish a
formal CapabilityContract per `SKILL_SPEC.md`.

### Target Capabilities
The explicitly-refused operation set (`CROP, FREEZE, REVERSE, IMAGE_INSERT, POSITION`)
is a real, named gap, but it is honestly declared unsupported rather than silently
approximated — which is itself the correct behavior `SPEC.md` requires. **Call: out of
scope for OS-architecture Target Capabilities.** Closing it is ordinary Skill-level
backlog work for `video-editing-skill`'s own maintainers (it would require new
ffmpeg-skill-level primitives, e.g. `edit.crop`/`edit.freeze`), not something blocked by
or owed to the OS today. No ground-truth document argues otherwise.

### Missing Capabilities
`CROP, FREEZE, REVERSE, IMAGE_INSERT, POSITION` — explicitly declared unsupported, not
silently approximated (`REPOSITORY_MAP.md`, `CAPABILITY_MATRIX.md` §1).

### Capabilities to Remove
None — the audit found zero evidence any current capability should be removed.

### Capabilities to Move
N/A — not a party to the qc-skill/media-analysis-skill collision.

### Dependencies
ffmpeg-skill (full delegation, every operation), via a single designated adapter module
(`ffmpeg_skill.py`/`adapter.py`), version-range-checked against `contract_version`
(`DEPENDENCY_GRAPH.md` §1.1). One of two Skills with a dedicated AST-walk security test
proving no other subprocess call exists anywhere (`REPOSITORY_MAP.md`).

### OS Interfaces
Has an in-code `contract.py` (per `SKILL_SPEC.md` §1's convergent-pattern table) but, per
`REPOSITORY_MAP.md` finding 4, no external schema file. To conform to `SPEC.md` §1 it
must additively gain `capabilities[].lifecycle`, `security.forbidden_keys`,
`input_artifact_types`/`output_artifact_types`, and populate `dependencies:
[{skill_id: "ffmpeg-skill", version_range}]` from its existing `SUPPORTED_MIN`/`MAX`
check.

### Agent Interfaces
**CURRENT:** one of `video-production-agent`'s manually-registered adapters
(`tools/video-editing/`), invoked as one subprocess per call. **FUTURE (Phase 3-4):**
once `SkillRegistry.select_tool()`'s hardcoded ordered candidate list is replaced with
real Provider resolution, an Operation naming `edit.trim` resolves to
`video-editing-skill` via the registry rather than a hand-edited table entry — no
behavior change for this Skill itself, only how the Agent finds it.

### QC Interfaces
Yes — its editing outputs (trimmed/cut/concatenated video artifacts) are exactly what
qc-skill's video checks (resolution/fps/codec/black-frame/freeze-frame/decode-integrity)
and media-analysis-skill's observational checks verify. `video-editing-skill` performs no
QC itself.

### Provenance
Same honest gap as ffmpeg-skill, one layer up: no independent provenance scheme is
documented beyond the delegation pattern, and no sidecar is persisted when invoked
outside the Agent (`PROVENANCE.md` §2's minimum field list is unmet on disk).

### Security
One of the two Skills (with `audio-production-skill`) confirmed via AST-walk to have
exactly one subprocess launch site (`SKILL_SPEC.md` §4.3, §5) — the strongest evidence
of "no raw shell execution" in the ecosystem. Has all 5 convergent primitives per
`SECURITY_MODEL.md` §1 (FORBIDDEN_KEYS-equivalent, symlink-resolved path containment,
`shell=False`, workspace-confined/no-clobber, process-group isolation via ffmpeg-skill's
own execution). `REPOSITORY_MAP.md` names it alongside `audio-production-skill` as
having a dedicated `test_security.py`-shaped repo test.

### Versioning
`skill.version` 0.1.0; no independent `contract_version` documented yet. Checks
ffmpeg-skill's `contract_version` against a `SUPPORTED_MIN`/`SUPPORTED_MAX` range at
startup — `VERSIONING.md` §2's cited proof pattern.

### Priority
Phase 2 (`ROADMAP.md`) — the one genuinely parallelizable phase, Skill-by-Skill.

### Migration Strategy
Publish CapabilityContract v1.0, zero behavior change.

---

## audio-production-skill

### Current Role
Gain/mix/normalize/dynamics audio Skill delegating to ffmpeg-skill
(`REPOSITORY_MAP.md`).

### Current Capabilities
`audio.gain, audio.trim, audio.cut, audio.silence_remove, audio.fade (in/out),
audio.normalize, audio.mix, audio.mono, audio.stereo, audio.downmix,
audio.noise_reduction, audio.dynamics, audio.concat` (`CAPABILITY_MATRIX.md` §2).

### Target Role
**NO CHANGE.** Same exemplary delegation pattern as `video-editing-skill`.

### Target Capabilities
None justified by evidence beyond the contract retrofit. `audio.silence_remove`
explicitly supports explicit ranges only (no detection built in) — detection is the
separate `measure.audio.silence` capability, composed by the caller
(`CAPABILITY_MATRIX.md` §2); this is correct separation, not a gap to close.

### Missing Capabilities
`CHANNEL_MAP, RESAMPLE, FORMAT_CONVERT` — explicitly refused, not approximated
(`REPOSITORY_MAP.md`, `CAPABILITY_MATRIX.md` §2).

### Capabilities to Remove
None — zero evidence for removal.

### Capabilities to Move
N/A.

### Dependencies
ffmpeg-skill (full delegation, every operation), same single-adapter-module pattern,
same AST-walk security test as `video-editing-skill` (`REPOSITORY_MAP.md`,
`DEPENDENCY_GRAPH.md` §1.1).

### OS Interfaces
Same retrofit needs as `video-editing-skill` — in-code `contract.py`, needs `lifecycle`,
`security.forbidden_keys`, `input_artifact_types`/`output_artifact_types`, and
`dependencies[]` populated from its ffmpeg-skill version-range check.

### Agent Interfaces
**CURRENT** manual `Service.adapter()` registration (`tools/audio-production/`).
**FUTURE Phase 3-4:** registry-driven Provider resolution replaces the hardcoded
candidate list for capabilities like `audio.normalize`/the `silence_cleanup` abstract
skill name — `SkillRegistry`'s own named example of an ordered tool-id list per
`REPOSITORY_MAP.md`, of which `audio-production-skill` is a direct candidate.

### QC Interfaces
Yes — its outputs (gain-adjusted, normalized, mixed audio) are what qc-skill's audio
checks (LUFS/LRA/true-peak, clipping, silence, channel layout) and
media-analysis-skill's loudness/silence analyzers verify.

### Provenance
Same honest gap as `video-editing-skill` — no persisted sidecar today; relies on
ffmpeg-skill's in-response reporting only.

### Security
Confirmed, alongside `video-editing-skill`, as one of the two repos with a dedicated
AST-walk `test_security.py`-shaped test proving exactly one subprocess launch site
(`SKILL_SPEC.md` §1, §4.3). Has all 5 convergent primitives per `SECURITY_MODEL.md` §1.

### Versioning
`skill.version` 0.1.0; checks ffmpeg-skill's `contract_version` via
`SUPPORTED_MIN`/`MAX` at startup (`VERSIONING.md` §2).

### Priority
Phase 2.

### Migration Strategy
Publish CapabilityContract v1.0, zero behavior change.

---

## color-grading-skill

### Current Role
HDR→SDR/LUT/color-tag technical color Skill delegating to ffmpeg-skill
(`REPOSITORY_MAP.md`).

### Current Capabilities
`color.hdr_to_sdr (7 tonemap curves), color.lut_apply, color.retag, color.strip_dovi`
(`CAPABILITY_MATRIX.md` §3).

### Target Role
**NO CHANGE.** Same delegation pattern; only needs a formal CapabilityContract.

### Target Capabilities
The refused creative-grading operation set is a real, named domain gap (technical/
delivery color only, not creative grading), but no ground-truth document directs the OS
architecture to close it. **Call: out of scope for OS-level Target Capabilities** — it is
Skill-level product scope, listed instead as a Missing Capability below.

### Missing Capabilities
`EXPOSURE, CONTRAST, SATURATION, TEMPERATURE, TINT, WHITE_BALANCE, GAMMA, LIFT, GAIN,
LEVELS, CURVES` — raises `UNSUPPORTED_OPERATION`, never approximated
(`REPOSITORY_MAP.md`, `CAPABILITY_MATRIX.md` §3).

### Capabilities to Remove
None.

### Capabilities to Move
N/A.

### Dependencies
ffmpeg-skill exclusively (same single-adapter pattern), with a notable security
refinement: a *separate* path allowlist for LUT files vs. input media roots
(`REPOSITORY_MAP.md`; generalized in `SECURITY_MODEL.md` §1/§3 as "multiple named roots,
not one workspace").

### OS Interfaces
Same retrofit needs as `video-editing-skill`/`audio-production-skill` (lifecycle,
`security.forbidden_keys`, artifact types, `dependencies[]`), plus its LUT-path-allowlist
detail is worth carrying forward as the worked example of a Skill needing more than one
declared containment root.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/color-grading/`). **FUTURE Phase 3-4:**
registry-driven resolution for `color.hdr_to_sdr` etc., same mechanics as other
delegating Skills.

### QC Interfaces
Yes — its outputs (tonemapped/LUT-applied/retagged video) are what qc-skill's
video-format and color-metadata checks verify.

### Provenance
Same honest sidecar gap as the other delegating Skills.

### Security
Delegation pattern confirmed (single adapter module, contract-version-checked);
AST-walk test presence is **UNKNOWN** specifically for this repo — `SKILL_SPEC.md` §1
lists the AST-walk test as confirmed only for `video-editing-skill` and
`audio-production-skill`, with the same shape "present in architecture" but unconfirmed
by AST-walk for `color-grading-skill`. Has the separate-LUT-allowlist refinement beyond
the baseline 5 primitives.

### Versioning
`skill.version` 0.1.0; ffmpeg-skill `contract_version`-range-checked at startup, one of
the three repos `VERSIONING.md` §2 names explicitly (`video-editing-skill`,
`audio-production-skill`, `color-grading-skill`).

### Priority
Phase 2.

### Migration Strategy
Publish CapabilityContract v1.0, zero behavior change.

---

## subtitle-skill

### Current Role
SRT/VTT generation + burn-in Skill: `generate` writes SRT/WebVTT directly from a typed
`SubtitleDocument` (no video I/O, no ffmpeg call); `render` delegates burn-in to
ffmpeg-skill's `caption` tool (`REPOSITORY_MAP.md`).

### Current Capabilities
`subtitle.generate, subtitle.render` (`CAPABILITY_MATRIX.md` §4).

### Target Role
**NO CHANGE.** The self/ffmpeg-skill split is already correct, and its deliberate
non-coupling to `transcription-skill` (composed at the Plan/Agent level, not a Skill
dependency) is explicitly named as "a real example of correct Capability composition"
(`REPOSITORY_MAP.md`) — this should stay exactly as is.

### Target Capabilities
None new as OS-driven work. `convert`, standalone `validate`, `offset`, `merge`, and
ASS/SSA are Skill-level backlog items, not OS gaps.

### Missing Capabilities
`convert`, standalone `validate`, `offset`, `merge`, ASS/SSA support — explicitly not
implemented (`REPOSITORY_MAP.md`, `CAPABILITY_MATRIX.md` §4).

### Capabilities to Remove
None.

### Capabilities to Move
N/A.

### Dependencies
ffmpeg-skill, partial — only `render`/burn-in delegates; `generate` has no ffmpeg
dependency at all (`DEPENDENCY_GRAPH.md` §1.1).

### OS Interfaces
Same retrofit needs as other delegating Skills, plus one specific and important
addition: its `output_schema` for cue text must gain the `untrusted_text: true` tag
PROPOSED in `SECURITY_MODEL.md` §7 and `SKILL_SPEC.md` §3.5 — the concrete fix for the
one live security gap named against this repo (cue text structurally validated but not
tagged as untrusted for downstream LLM-prompt use).

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/subtitle/`). Composition with
`transcription-skill`'s output happens at the Agent/Plan level today (two Operations,
one DAG edge, per `CAPABILITY_MODEL.md`'s worked example) — this does **NOT** change
under Phase 3-4; the OS explicitly keeps this composition at the Plan level rather than
making it a Skill-to-Skill dependency.

### QC Interfaces
Yes — its SRT/VTT/ASS output is what qc-skill's subtitle-timing check
(`measure.subtitle.timing`) verifies (timing only, no semantic/wording checks,
`CAPABILITY_MATRIX.md` §8b).

### Provenance
Same honest sidecar gap as other delegating Skills for the `render` path. `generate`'s
plain-text SRT/VTT output has no metadata slot to embed provenance into at all —
`PROVENANCE.md` §3 names this repo's output format explicitly ("some outputs, e.g. a raw
SRT file, have no metadata slot to embed into"), so a sidecar-JSON pattern is the only
viable option for this Skill, not embedded metadata.

### Security
Delegation pattern (partial) confirmed for `render`. This repo carries the **one live,
present, named security gap** in the whole ecosystem: cue-text validation is structural
only (control characters, line length, reading speed) with no defense against that text
later reaching an LLM prompt unsanitized downstream (`REPOSITORY_MAP.md`,
`ARCHITECTURE.md` §7, `SECURITY_MODEL.md` §7). This is the canonical example motivating
`SKILL_SPEC.md` §3.5's untrusted-text tagging requirement — `subtitle-skill` itself needs
no behavior change (its structural validation "remains correct and sufficient for its
own stated scope," `SECURITY_MODEL.md` §7 item 3); the fix is a schema annotation plus an
Agent-side prompt-construction rule.

### Versioning
`skill.version` 0.1.0; no independent `contract_version` documented yet.

### Priority
Phase 2 — the `untrusted_text` schema tag is naturally scoped into the same contract
retrofit, since it's an `output_schema` field addition, not new capability code.

### Migration Strategy
Publish CapabilityContract v1.0 with the `untrusted_text: true` annotation added to
cue-text output fields — additive schema-only change, zero behavior change to the
Skill's actual generate/render logic.

---

## motion-graphics-skill

### Current Role
Title cards/lower-thirds/overlays Skill built entirely on ffmpeg-skill's
`graphics`/`overlay`/`probe` tools — not Remotion, not Lottie, not After Effects
(`REPOSITORY_MAP.md`).

### Current Capabilities
`motion_graphics.title_card, motion_graphics.lower_third, motion_graphics.overlay`
(`CAPABILITY_MATRIX.md` §5).

### Target Role
**NO CHANGE.**

### Target Capabilities
None justified — animation richness (scale/slide, user-authorable templates) is
Skill-level product scope; no OS-architecture document makes a case for prioritizing it.

### Missing Capabilities
Lower-third templates are fixed/built-in only, not user-authorable animation;
image/logo overlay supports linear fade only, no scale/slide animation
(`CAPABILITY_MATRIX.md` §5).

### Capabilities to Remove
None.

### Capabilities to Move
N/A.

### Dependencies
ffmpeg-skill, full delegation (`DEPENDENCY_GRAPH.md` §1.1).

### OS Interfaces
Same retrofit needs as the other delegating Skills. Also note the explicit naming
distinction `CAPABILITY_MATRIX.md` §1 flags: `motion_graphics.overlay` is a **different**
capability id from `edit.overlay` even though both ultimately call ffmpeg-skill's
overlay-family tools — this distinction must be preserved, not collapsed, when this
Skill publishes its contract; no audit evidence supports treating them as one id.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/motion-graphics/`). Its own architecture
doc explicitly lists "MCP" among things it deliberately does not do
(`REPOSITORY_MAP.md`, `ARCHITECTURE.md` §5) — this does not change under Phase 3-4; MCP
remains an optional external adapter, never required by registry-driven discovery.

### QC Interfaces
Likely yes in general shape (its title-card/lower-third/overlay output is video), but no
dedicated motion-graphics-specific QC check is named anywhere in `REPOSITORY_MAP.md` or
`CAPABILITY_MATRIX.md` — treat the specific mapping as inferred from the general
editing/graphics-output-verified-by-qc-skill pattern, not a confirmed dedicated check.

### Provenance
Same honest sidecar gap as other delegating Skills.

### Security
Delegation pattern present; AST-walk test presence is **UNKNOWN** specifically for this
repo — `SKILL_SPEC.md` §1 notes the pattern is "present in architecture" but
"unconfirmed by AST-walk specifically" for `motion-graphics-skill`.

### Versioning
`skill.version` 0.1.0; no independent `contract_version` documented; delegates via the
same single-adapter pattern (version-range-checked).

### Priority
Phase 2.

### Migration Strategy
Publish CapabilityContract v1.0, zero behavior change.

---

## thumbnail-skill

### Current Role
Raster thumbnail composition — `validate`, `render` (Pillow-based, "never touches
ffmpeg" for composition), `extract_frame` (delegates to ffmpeg-skill's `look`/`probe`
for the one video-decoding step needed) (`REPOSITORY_MAP.md`).

### Current Capabilities
`thumbnail.render, thumbnail.extract_frame` (`CAPABILITY_MATRIX.md` §6).

### Target Role
**NO CHANGE.**

### Target Capabilities
None justified — AI-generated thumbnails, "best-frame" selection, and face detection are
explicitly refused by design (a deliberate scope decision), and no ground-truth document
argues for reversing it.

### Missing Capabilities
No AI-generated thumbnails, no "best-frame" selection, no face detection — explicitly
refused by design (`REPOSITORY_MAP.md`, `CAPABILITY_MATRIX.md` §6).

### Capabilities to Remove
None.

### Capabilities to Move
N/A.

### Dependencies
ffmpeg-skill, partial — only `extract_frame` delegates; `render`'s Pillow compositing has
no ffmpeg dependency (`DEPENDENCY_GRAPH.md` §1.1). The only repo in the ecosystem with a
real third-party pip dependency, `Pillow>=10.0` (`REPOSITORY_MAP.md`).

### OS Interfaces
Same retrofit needs as other delegating Skills, plus one open question this document
does not resolve: `SPEC.md` §1's `dependencies` field models Skill-to-Skill dependencies
(`{skill_id, version_range}`); whether/how `Pillow>=10.0` (a third-party pip dependency,
not a Skill) belongs in the same field or a separate declaration is **UNKNOWN** — no
ground-truth document addresses non-Skill dependency declaration.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/thumbnail/`). **FUTURE Phase 3-4:**
registry-driven resolution for `thumbnail.render`/`thumbnail.extract_frame`, same
mechanics as other delegating Skills.

### QC Interfaces
**UNKNOWN.** Thumbnails are image artifacts, and none of qc-skill's documented checks
(video/audio/subtitle/delivery) or media-analysis-skill's documented analyzers explicitly
name thumbnail images as a target. Not confirmed N/A, not confirmed covered.

### Provenance
Same honest sidecar gap for the `extract_frame` path; the `render`/Pillow-only path has
no ffmpeg-skill response to draw provenance from at all — an even more complete gap than
the ffmpeg-delegating Skills, not documented as closed anywhere.

### Security
Delegation pattern (partial) present for `extract_frame`; AST-walk test presence is
**UNKNOWN** specifically for this repo (same "present in architecture, unconfirmed by
AST-walk" caveat as `color-grading-skill`/`motion-graphics-skill`, `SKILL_SPEC.md` §1).

### Versioning
`skill.version` 0.1.0; ffmpeg-skill `contract_version`-checked for the `extract_frame`
path only.

### Priority
Phase 2.

### Migration Strategy
Publish CapabilityContract v1.0, zero behavior change.

---

## qc-skill

### Current Role
Deterministic production verification — `QCStatus = PASS|WARN|FAIL|UNKNOWN`, worst-wins
aggregation, `QCMeasurement → QCFinding → QCCheck → QCReport`; explicit ADR-001 boundary:
"qc-skill is not an AI agent and does not make production decisions"
(`REPOSITORY_MAP.md`).

### Current Capabilities
Collision rows (shared with media-analysis-skill): `measure.audio.loudness,
measure.audio.silence, measure.audio.integrity`. qc-skill-exclusive: `measure.video.freeze,
measure.video.black_frame, measure.audio.clipping_and_dynamics,
measure.audio.channel_layout, measure.video.format, measure.subtitle.timing,
measure.delivery.integrity` (`CAPABILITY_MATRIX.md` §8a/§8b).

### Target Role
**NO CHANGE.** Its ADR-001 boundary is exactly right and is the reference implementation
`ARCHITECTURE.md` §3 cites for "the OS never makes a production decision." It only needs
to publish a formal CapabilityContract and register its collision capabilities as
Providers per `CAPABILITY_MODEL.md`.

### Target Capabilities
None new — the only actionable item is registering its existing measurements as
Providers of shared Capability ids (Phase 3 registration work, not a new measurement to
build).

### Missing Capabilities
None declared-unsupported beyond its explicit boundary (it does not decide, does not
render/publish/block — `REPOSITORY_MAP.md`'s boundary-enforcement section).

### Capabilities to Remove
None — the audit found zero evidence any current capability should be removed.

### Capabilities to Move
**Neither moves.** Per `CAPABILITY_MODEL.md`'s explicit decision, qc-skill and
media-analysis-skill both register as Providers of the same Capability id
(`measure.audio.loudness`, `measure.audio.silence`, `measure.audio.integrity`). The
collision becomes a visible, resolvable registry fact, not a migration of code from one
repo to the other. `ROADMAP.md` Phase 3 delivers exactly this registration, not a code
move.

### Dependencies
None — talks to `ffmpeg`/`ffprobe` binaries directly, read-only; does not depend on the
ffmpeg-skill package at all (`DEPENDENCY_GRAPH.md` §1.2).

### OS Interfaces
In-code `contract.py`; needs `capabilities[].lifecycle`, `security.forbidden_keys` (it
already enforces `FORBIDDEN_KEYS` including `filter`/`filter_complex` — this becomes the
declared field), `input_artifact_types`/`output_artifact_types`, and — since it has no
upstream Skill dependency — an empty `dependencies: []`, the same shape caveat
`ROADMAP.md` Phase 2 names for the three direct-to-binary Skills ("slightly different in
shape, not harder"). Its `identity` scheme is already the exact model `PROVENANCE.md`
generalizes verbatim — no change needed there, only exposure via the contract.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/qc/`). **FUTURE Phase 3 specifically:**
qc-skill is one of the two Providers in the ecosystem's one confirmed Capability
collision — `SkillRegistry.select_tool()`'s first-match-wins logic is replaced with the
three-tier collision policy (Plan-time explicit `provider_id` → default-provider policy →
registry refusal), the first mechanic that actually changes how the Agent chooses between
this Skill and media-analysis-skill.

### QC Interfaces
**N/A** — qc-skill IS the QC layer; it does not consume another Skill's QC output, it
produces the `QCReport` other Capabilities are verified against.

### Provenance
Already the cleanest reproducibility-identity design in the ecosystem: `identity =
sha256(canonical_json({skill, skill_version, kind, operation, asset_fingerprints,
effective_parameters, rules, ffmpeg_version, ffprobe_version}))`, explicitly excluding
timestamps/paths/`request_id` (`REPOSITORY_MAP.md`; `PROVENANCE.md` §1 adopts this
verbatim, not generalized-with-changes). Real file-based cache, sharded, atomic write,
with tamper detection (a cache hit is only honored if the stored result-hash still
matches the recomputed hash). This already meets or exceeds `PROVENANCE.md` §2's minimum
field list — no gap named.

### Security
Has all 5 convergent primitives, and exceeds the baseline in two ways
`SECURITY_MODEL.md` names explicitly: `FORBIDDEN_KEYS` additionally denies
`filter`/`filter_complex` specifically, and its symlink-resolved path containment is
"the strongest documented version" in the ecosystem (`SECURITY_MODEL.md` §1, §3).
Honest, named gap shared with media-analysis-skill: no CPU/memory/disk resource limits,
only a wall-clock timeout (`REPOSITORY_MAP.md`, `SECURITY_MODEL.md` §5).

### Versioning
`skill.version` 0.1.0; no independent `contract_version` documented yet; no upstream
Skill dependency to pin against.

### Priority
Phase 2 for its own contract retrofit; Phase 3 specifically for the collision-resolution
work with media-analysis-skill (`ROADMAP.md`).

### Migration Strategy
Publish CapabilityContract v1.0 (registering `measure.audio.loudness`/`silence`/
`integrity` as Provider entries), zero behavior change to its measurement logic itself.

---

## media-analysis-skill

### Current Role
Deterministic observation — `media_probe, stream_layout, video_format, audio_format,
duration` (ffprobe-only), `silence, loudness, integrity` (full decode), `scene_detection`
(explicitly "not semantic scenes"), `timing` (A-V sync). "No AI." Purely observational —
no media-writing code path (`REPOSITORY_MAP.md`).

### Current Capabilities
Collision rows (shared with qc-skill): `measure.audio.loudness, measure.audio.silence,
measure.audio.integrity`. media-analysis-skill-exclusive: `measure.video.scene_detection,
measure.video.timing, measure.video.probe / measure.*.format / measure.*.duration`
(`CAPABILITY_MATRIX.md` §8a/§8c).

### Target Role
**NO CHANGE.** Its purely observational, no-AI scope is correct and explicitly named as
such; it only needs a formal CapabilityContract and Provider registration.

### Target Capabilities
None new — same as qc-skill, the only actionable item is Provider registration of its
existing measurements, not new measurement capability.

### Missing Capabilities
Explicitly out of scope by design: freeze-frame detection, black-frame detection,
semantic/content understanding, speaker detection, transcription, captions, thumbnails
(`REPOSITORY_MAP.md`).

### Capabilities to Remove
None — the audit found zero evidence any current capability should be removed.

### Capabilities to Move
**Neither moves.** Same as qc-skill's row: per `CAPABILITY_MODEL.md`'s decision,
media-analysis-skill and qc-skill both register as Providers of `measure.audio.loudness`,
`measure.audio.silence`, and `measure.audio.integrity` — the fix is registration, not
relocating code from one repo into the other.

### Dependencies
None — talks to `ffmpeg`/`ffprobe` binaries directly, read-only; no dependency on the
ffmpeg-skill package (`DEPENDENCY_GRAPH.md` §1.2).

### OS Interfaces
Same shape as qc-skill's OS-interface needs (lifecycle, `security.forbidden_keys`,
artifact types, empty `dependencies[]`). Its own `docs/decisions.md` ADR-010 already
explicitly defers an MCP server ("can be added as a thin wrapper over `run` later") —
this repo's contract-shape work does not need to include MCP.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/media-analysis/`). **FUTURE Phase 3:**
same collision-resolution mechanics as qc-skill — the other half of the ecosystem's one
confirmed Provider collision. Notable asymmetry (`REPOSITORY_MAP.md`): awareness of the
overlap is one-directional — qc-skill's docs reference media-analysis-skill by name;
media-analysis-skill's own docs contain zero references to qc-skill despite
acknowledging overlap with ffmpeg-skill. This asymmetry does not need to be "fixed" in
media-analysis-skill's own docs; Phase 3's registry makes the collision a visible fact
regardless of which repo's docs mention the other.

### QC Interfaces
**N/A** — media-analysis-skill IS the observation layer, alongside qc-skill; it does not
consume another Skill's QC output. Its own docs explicitly frame the choice between it
and qc-skill as "the agent's choice" — exactly the choice `CAPABILITY_MODEL.md`'s
collision policy formalizes.

### Provenance
**UNKNOWN.** No dedicated identity/cache scheme comparable to qc-skill's is documented in
`REPOSITORY_MAP.md`'s media-analysis-skill section — not confirmed absent outright, but
not confirmed present either. This is a real, named asymmetry relative to its sibling
Provider (qc-skill), worth flagging rather than assuming parity.

### Security
Matches qc-skill's pattern closely per `REPOSITORY_MAP.md`: no shell, `PATH`-only binary
resolution, `-protocol_whitelist file`, `-nostdin`, workspace-confined writes, output
verification rejecting secret-looking/command-like keys. Same honest gap as qc-skill: no
CPU/memory/disk resource limits, only wall-clock timeout.

### Versioning
`skill.version` 0.1.0; no independent `contract_version` documented; no upstream Skill
dependency.

### Priority
Phase 2 for contract retrofit; Phase 3 for collision resolution with qc-skill.

### Migration Strategy
Publish CapabilityContract v1.0 (registering the same three Provider entries as
qc-skill), zero behavior change.

---

## transcription-skill

### Current Role
Local-only ASR via `faster-whisper` (CTranslate2 Whisper), run in an isolated child
process/process-group; no diarization; no cloud ASR path by deliberate ADR-002 choice
(`REPOSITORY_MAP.md`). Not in the task brief's original "9 skills" list but a real,
active ecosystem member.

### Current Capabilities
`transcribe.audio` (`CAPABILITY_MATRIX.md` §7).

### Target Role
**NO CHANGE.** Its local-only, no-diarization scope is a deliberate, documented choice
(ADR-002), not a gap.

### Target Capabilities
A future cloud-ASR Provider of `transcribe.audio` alongside the local `faster-whisper`
engine is explicitly named in `CAPABILITY_MODEL.md` §3 as the natural extension point —
but as a **new Provider**, not a change to `transcription-skill` itself (its own
`engines/registry.py` already supports adding engines without redesign). **Call: no
Target Capability for this repo's own contract** beyond publishing what exists; the
multi-provider extension is ecosystem-level FUTURE work, not a gap in this Skill.

### Missing Capabilities
No diarization (`speaker_id` always null); no cloud ASR path (deliberate, ADR-002)
(`REPOSITORY_MAP.md`).

### Capabilities to Remove
None.

### Capabilities to Move
N/A.

### Dependencies
None on any other Skill — runs `faster-whisper` as an isolated child process it manages
itself (`DEPENDENCY_GRAPH.md` §1.3). Cross-referenced by `subtitle-skill`'s README and
`video-production-agent`'s integration CI, but neither of those is a dependency of
`transcription-skill` — the reference runs the other direction.

### OS Interfaces
The only Skill with real standalone JSON Schema files (`schemas/transcript.schema.json`,
`engine_spec.schema.json`, `speech_event.schema.json`) rather than an in-code generator
(`REPOSITORY_MAP.md`, `SKILL_SPEC.md` §1) — this is actually ahead of most other Skills
for OS-Interface readiness. It mainly needs to add `capabilities[].lifecycle`,
`security.forbidden_keys`, and wrap its existing schemas into the `CapabilityContract`
envelope shape (`SPEC.md` §1), not build new schema infrastructure from scratch.

### Agent Interfaces
**CURRENT** manual adapter registration (`tools/transcription/`), one of
`video-production-agent`'s 10 sibling-repo integration-CI clones (`DEPENDENCY_GRAPH.md`
§1.4 — cloned at default-branch HEAD, per the versioning inconsistency
`DEPENDENCY_GRAPH.md` §2 flags). Its `run -` stdin/stdout transport is described in its
own ADR-021 as "exactly what an MCP transport would also wrap" — MCP-shaped but not an
actual server (`REPOSITORY_MAP.md`); this does not need to change under Phase 3-4.
Composition with `subtitle-skill` happens at the Agent/Plan level (two Operations, one
DAG edge), unchanged.

### QC Interfaces
**UNKNOWN, likely gap.** Its `Transcript`/`SpeechEvent` output is not named as a target
of any qc-skill or media-analysis-skill check in `REPOSITORY_MAP.md`/
`CAPABILITY_MATRIX.md` — transcription accuracy/quality has no documented QC Capability
anywhere in the ecosystem today.

### Provenance
**UNKNOWN.** No dedicated identity/cache scheme is documented, similar to
media-analysis-skill's gap — not confirmed whether one exists beyond ordinary CLI
`--json` output.

### Security
Runs in an isolated child process/process-group so a timeout can hard-kill it
(`REPOSITORY_MAP.md`) — process isolation confirmed. `SECURITY_MODEL.md` §1 names
`transcription-skill` as one of the repos where the convergent 5-primitive pattern was
independently found. No cloud ASR path means no network-security surface to consider
(consistent with `SPEC.md` §7's observation that no repo talks to a network service).

### Versioning
`skill.version` 0.2.0 — ahead of every other Skill's 0.1.0; no independent
`contract_version` documented; no upstream Skill dependency to pin against.

### Priority
Phase 2 — its retrofit is "slightly different in shape, not harder" per `ROADMAP.md`'s
caveat for Skills without a `dependencies` field to fill (grouped with
qc-skill/media-analysis-skill/ffmpeg-skill in that respect, though `transcription-skill`'s
real per-engine dependency, `faster-whisper`, is a pip dependency, not a Skill
dependency).

### Migration Strategy
Publish CapabilityContract v1.0 wrapping its existing standalone JSON Schemas, zero
behavior change.

---

## video-production-agent

**Usable but incomplete — the first consumer of the OS, not the OS itself.** This row
is written with extra care to separate what is CURRENT (already built and verified in
source), FUTURE (proposed direction, not implemented), and what must never be claimed as
done that isn't — per the explicit task instruction and `REPOSITORY_MAP.md`'s own framing.

### Current Role
**CURRENT:** the orchestrator — a CLI (`video-agent`) running `Observation → Event →
Inference/Decision → ProductionPlan → Project IR → Compiler → Operation →
Executor(ToolRouter) → Artifact → QA`, all real, distinctly named types
(`REPOSITORY_MAP.md`). Skill invocation is one subprocess per call via per-skill
adapters under `tools/<skill>/`; discovery is static and manual via `Service.adapter()` —
"no package loader, plugin manager or dynamic import" (direct quote). `SkillRegistry`
maps abstract production skills (e.g. `silence_cleanup`) to an ordered list of candidate
tool ids and picks the first one whose adapter is registered and capability is
`AVAILABLE`. Per `REPOSITORY_MAP.md` and `ARCHITECTURE.md` §1: "the first major consumer
and orchestration layer of the future OS, not the OS itself, and not a finished reference
architecture."

### Current Capabilities
Not a Provider of any media-processing Capability itself — it is the consumer/
orchestrator that resolves and invokes the 10 Skills' Capabilities. Its own
"capabilities" are orchestration primitives, all CURRENT: Observation/Inference/Decision
types (`CORE_PRIMITIVES.md` §5, adopted as-is by the OS), ProductionPlan/Operation
compilation (§6), Artifact/provenance model (§7, §10), Job/resume support (§11). 34 ADRs
and a Phase 1→3 internal progression are **self-reported**, not independently verified
commit-by-commit (`REPOSITORY_MAP.md`).

### Target Role
Per `ARCHITECTURE.md` §1 and §3, its role does not change in kind — it stays an Agent
(one of possibly several), never folded into the OS. What changes is *how* it discovers
and resolves Skills: **FUTURE**, dynamic capability-driven discovery replaces the manual
`Service.adapter()` registration (Phase 4, `ROADMAP.md`); **FUTURE**, real
Provider-collision resolution replaces `SkillRegistry`'s hardcoded ordered-candidate-list
`select_tool()` (Phase 3, `ROADMAP.md`). **CURRENT and unchanged throughout every
phase:** the Observation → Event → Inference/Decision → ProductionPlan → Project IR →
Compiler → Operation → Executor → Artifact → QA pipeline itself, the
`FORBIDDEN_ARG_KEYS` security pattern, and the provenance/artifact model —
`ROADMAP.md`'s "What changes... and what does not" section states this explicitly.

### Target Capabilities
N/A in the Capability sense — it does not register as a Provider. Its "target
capability" is architectural (real registry-driven resolution), not a new media
operation.

### Missing Capabilities
Explicitly **NOT** implemented today, per code and docs (`REPOSITORY_MAP.md`): a web UI,
a job queue, natural-language intent understanding backed by a real model, a
multicam/conference pipeline body (registered but `implemented=False`), any plugin
manager for adding Skills without editing source, remote APIs, cloud storage, a database.
Per explicit task instruction and `REPOSITORY_MAP.md`, the OS must not have missing Agent
functionality invented on its behalf for any of these.

### Capabilities to Remove
None — the audit found zero evidence anything already built (the
O/I/D/Plan/IR/Compiler/Executor pipeline, the forbidden-key security pattern, the
provenance/artifact model) should be discarded; `ARCHITECTURE.md` §2 explicitly
instructs "don't discard what's already correct."

### Capabilities to Move
N/A — not a Provider in the qc-skill/media-analysis-skill collision sense.

### Dependencies
All 10 Skill repos, via its adapter layer (`tools/<skill>/`), one adapter per Skill, one
subprocess per call, JSON in/out. `jsonschema>=4.17` is its only pip dependency; it
imports no Skill's Python package directly (`DEPENDENCY_GRAPH.md` §1.4).

### OS Interfaces
**CURRENT:** `video_agent.models.{Observation, Inference, Decision, ...}` already have
the right shape and are "candidates to become an OS contract package"
(`avpos-contracts` or similar) that `video-production-agent` would then depend on rather
than define (`ARCHITECTURE.md` §3). **FUTURE, explicitly deferred, not decided:**
whether/when this extraction happens — `ROADMAP.md` states "at no phase does this
roadmap propose extracting `video_agent.models`... into a separate `avpos-contracts`
package," compatible with doing so after Phase 1 but not required at any specific phase.
Its own `skills/contract.py` module (the "no package loader, plugin manager or dynamic
import" module) is the direct-quote source of the terminology-collision finding
motivating `CAPABILITY_MODEL.md`'s Capability/Skill split — this module is Agent-side
code that consumes other Skills' contracts, not something that itself publishes a
CapabilityContract.

### Agent Interfaces
**CURRENT:** `Service.adapter()` manual registration is the actual mechanism today;
`SkillRegistry.select_tool()` picks the first candidate in a hardcoded ordered list whose
adapter is registered and capability is `AVAILABLE` — a silent default
(`CAPABILITY_MODEL.md`'s own words: "this OS replaces with an explicit,
provenance-recorded choice"). **FUTURE Phase 3 (`ROADMAP.md`):**
`SkillRegistry.select_tool()`'s Provider-selection logic is replaced with the three-tier
collision policy — Plan-time explicit `provider_id` → default-provider policy → registry
refusal — the **first** phase that touches `video-production-agent`'s code at all.
**FUTURE Phase 4:** `Service.adapter()`'s manual wiring is replaced with registry-driven
discovery — an Operation names a `capability_id` and optional `provider_id`, and the
Executor resolves which Skill/adapter to invoke from the registry. **Explicitly NOT
changed at any phase:** the Observation/Inference/Decision types, the
Plan/Compiler/Operation shapes, `FORBIDDEN_ARG_KEYS`, per-process-group subprocess
isolation, `idempotency_key`/`render --resume` machinery (`ROADMAP.md`'s explicit "what
does not change" section).

### QC Interfaces
`video-production-agent` consumes qc-skill's `QCReport` as one of its adapters
(`tools/qc/`) — it does not produce QC itself; its own "QA" pipeline stage is the point
where a `QCReport`'s PASS/WARN/FAIL/UNKNOWN is read, never where a verdict is computed
(`ARCHITECTURE.md` §3's explicit rule: "the OS never makes a production decision... a QC
FAIL is a fact, not an instruction to re-render"). **FUTURE Phase 5:** qc-skill's
verification extends to check against a Plan's declared intent, which
`video-production-agent`'s Executor/Plan model will need to supply the necessary
provenance links for (`produced_by`/`derived_from`) — this depends on Phase 4's Artifact
model landing first.

### Provenance
**CURRENT, already substantial:** `Artifact` carries `hash, plan_id/plan_version,
job_id/jobs, stage (working→candidate→approved→final→archive)`, and a `provenance` dict
of `ir_path, plan_hash, ir_hash, provenance_path`; `ProjectIR.provenance` carries
`source_hashes, profile_version, skill_versions, tool_versions, ai_calls, recovery, runs,
plan_hash, ir_hash`; cache-hit provenance is explicitly eval-tested
(`REPOSITORY_MAP.md`, `PROVENANCE.md` §1). Against `PROVENANCE.md` §2's minimum field
list, it already covers essentially every required field for Agent-orchestrated runs —
the one thing it does not yet emit is a discrete `ProductionReceipt` artifact
(**FUTURE**, `ROADMAP.md` Phase 6, buildable directly from these existing fields per
`PROVENANCE.md` §4, not a redesign).

### Security
**CURRENT**, all 5 convergent primitives plus more: `FORBIDDEN_ARG_KEYS` blocks
`command, argv, shell, exec, filter_complex, api_key, token` recursively before reaching
any adapter; every subprocess runs in its own process group; `SYSTEM_CONSTRAINTS`
hard-codes `execution.no_raw_shell` and `execution.recovery.max_attempts=2`; adversarial
eval cases exist by name (`20_path_traversal_block.json`,
`11_plan_hostile_ai_no_leakage.json`) (`REPOSITORY_MAP.md`). This is the richest security
implementation in the ecosystem, per `ARCHITECTURE.md` §7's summary and §9.3's red-team
verdict.

### Versioning
Its own release version is 0.1.0; its only pip dependency, `jsonschema>=4.17`, is a
version *range*, matching `VERSIONING.md` §2's proposed rule even for its own dependency
style. Project IR has real migration support (`project/migrations.py`, a `CURRENT`
version constant) — `VERSIONING.md` §5 cites this as the existing, working pattern for IR
schema evolution that the OS explicitly does not propose replacing. It has no
`contract_version` of its own in the Skill sense — it is not a Skill; it is the Agent
that consumes Skills' `contract_version`s.

### Priority
Phase 3 is the first phase to touch its code (`SkillRegistry` Provider-selection). Phase
4 is the largest single code-change phase in the whole roadmap, touching its actual
execution path (`execution/compiler.py` → `execution/executor.py`), rated
moderate-to-high risk specifically because it must not regress the self-reported 187
unit / 90 adapter / 99 eval test counts (`ROADMAP.md` — `REPOSITORY_MAP.md` flags these
counts were never independently re-run, so Phase 4 must re-establish a verified baseline
first, not trust the reported numbers as ground truth). Phases 5-6 add Plan-intent-aware
QC and `ProductionReceipt` emission on top of its existing provenance fields.

### Migration Strategy
**Not** "publish CapabilityContract v1.0, zero behavior change" — this is the one row
where migration is genuinely more than contract-publishing:
- **Phase 1-2:** zero changes required (pure schema/library work landing outside this
  repo).
- **Phase 3:** replace `SkillRegistry.select_tool()`'s first-match-wins logic with the
  collision policy, after first re-establishing a verified test baseline (the
  self-reported 99/99 eval count was never independently confirmed).
- **Phase 4:** replace `Service.adapter()`'s manual wiring with registry-driven
  discovery in the Executor, without changing the Operation/Execution concepts' shape or
  regressing `FORBIDDEN_ARG_KEYS`/process-group isolation/`idempotency_key` behavior.
- **Phases 5-6:** additive consumption of new QC-intent and `ProductionReceipt`
  capabilities layered on existing provenance fields.
- At no phase is `video_agent.models` extraction into a separate contract package
  required (`ARCHITECTURE.md` §3, `ROADMAP.md` — explicitly deferred, not scheduled).

---

## Summary table (pointer only — not a substitute for the sections above)

| Repo | Target Role change? | Priority phase(s) | Migration complexity |
|---|---|---|---|
| ffmpeg-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| video-editing-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| audio-production-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| color-grading-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| subtitle-skill | NO CHANGE | Phase 2 | Contract retrofit + `untrusted_text` tag |
| motion-graphics-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| thumbnail-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| qc-skill | NO CHANGE | Phase 2, Phase 3 | Contract retrofit + Provider registration |
| media-analysis-skill | NO CHANGE | Phase 2, Phase 3 | Contract retrofit + Provider registration |
| transcription-skill | NO CHANGE | Phase 2 | Contract retrofit only |
| video-production-agent | Discovery/resolution mechanics change; pipeline unchanged | Phase 3, Phase 4, Phase 5-6 | Genuine code change, not contract-only |
