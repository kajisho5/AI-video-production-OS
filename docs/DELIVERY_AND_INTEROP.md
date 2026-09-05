# Delivery and Interoperability

This document answers ten scoped questions the earlier architecture documents left open:
whether media relationships need a graph, whether format/codec knowledge needs a new
abstraction, whether "media engine" deserves to be a first-class OS concept today,
whether external NLE/DAW/asset-management interop needs a neutral model now, how
multimodal input and output fit the existing contracts, where accessibility and
localization sit in the Capability/Skill taxonomy, how delivery targets and profiles
should be modeled, and how the architecture stays open to future media types without
redesigning anything today.

As throughout this project: **CURRENT** means verified in the audited repos
(`REPOSITORY_MAP.md`), **FUTURE** means proposed and not implemented anywhere,
**EXPERIMENTAL** means present but unstable/stubbed, **UNKNOWN** means not
determinable from available evidence. This document introduces **zero new OS
primitives** — every question below is answered by pointing at a primitive
`CORE_PRIMITIVES.md`, `ARTIFACT_MODEL.md`, `CAPABILITY_MODEL.md`, `ARCHITECTURE.md`, or
`TIMELINE_MODEL.md` already defines, or by explicitly deferring with a reason. Where the
task brief's phrasing implies a new noun (a "media asset graph," a "media engine
abstraction," a "localization skill," a "delivery skill"), the recurring finding is that
the noun is unnecessary — an existing primitive already covers the need — and this
document says so directly rather than inventing scope to fill the section.

## 1. Media asset graph

**Question:** should source → proxy → edited timeline → render → color grade → master →
social variant relationships be modeled as a graph, artifact lineage, manifest, or
database?

**Answer: this is `ARTIFACT_MODEL.md`'s `derived_from` field, not a new concept.**
`derived_from: [ArtifactId]` is already specified on every `Artifact` (`ARTIFACT_MODEL.md`
§3, `SPEC.md` §2) as **FUTURE** — named, reasoned about, and explicitly not implemented
anywhere in the audited ecosystem today. The relationships in the task's example chain are
exactly what that field is for:

```
source.mp4 (video)
  --derived_from--> proxy.mp4 (video)
  --derived_from--> Timeline_v3 (timeline, per TIMELINE_MODEL.md §4.2's Timeline_v0→v1→v2→v3 chain)
  --derived_from--> rough_render.mp4 (video)
  --derived_from--> graded_master.mp4 (video, via color.hdr-to-sdr)
  --derived_from--> youtube_1080p.mp4 (video, a delivery variant — see §9 below)
```

This is a DAG only in the same sense `ARCHITECTURE.md` §6 already establishes for
`ProductionPlan`s: edges between content-hashed, immutable nodes, with no separate
traversal engine required to make it "a graph" in the infrastructure sense. Every edge is
one Operation's declared `inputs`/`outputs` (`SPEC.md` §3), already present as
information in the Plan/step history — `derived_from` is a **denormalization** of that
information onto the Artifact record for direct lookup, not a new source of truth
(`ARTIFACT_MODEL.md` §3 makes this same point about the field in general; this section
confirms it holds for the full source-to-delivery chain specifically, not only for the
Timeline case `TIMELINE_MODEL.md` already worked through).

**Why not a graph database:** a hypothetical production's full lineage — source, one or
two proxies, a handful of Timeline revisions, a render, a grade, three or four delivery
variants — is a few dozen edges, each a handful of hash references. No audited repo
processes concurrent productions at a scale where graph-database query patterns (transitive
closure over millions of edges, graph algorithms, distributed storage) would matter; per
`ARCHITECTURE.md` §9 lens 5 and §10, this project does not solve for scale nobody has
evidence of. `derived_from` is queryable with the same tools already used to read any other
Artifact record (a JSON field, a handful of hash strings) — walking "what was this master
graded from" is a `derived_from` pointer-chase, not a Cypher query.

**Why not a separate manifest:** a manifest implies a document independently maintained
alongside the Artifacts it describes, which is precisely the two-sources-of-truth risk
`ARTIFACT_MODEL.md` and `TIMELINE_MODEL.md` §6 both already argue against (see
`TIMELINE_MODEL.md` §6.3, rejecting a second IR for the same reason). Lineage lives on the
Artifact itself, not in a side file that could drift from it.

**What remains a named, honest gap:** exactly the one `ARTIFACT_MODEL.md` §3 already
names — `derived_from` is proposed, low-risk, and not built anywhere. This document adds
nothing to that gap beyond confirming that the full source-to-social-variant chain is an
instance of it, not a reason to design something bigger.

## 2. Format/codec abstraction

**Question:** does the OS need a way to reason about container, codec, resolution, frame
rate, HDR/SDR, color space, audio format, and subtitle format?

**CURRENT, at the Skill level; the OS's job is discoverability, not invention.**
Per-Skill format-awareness already exists and is typed, not stringly-typed guesswork:

- `color-grading-skill` (`REPOSITORY_MAP.md`) has typed operations for exactly this
  domain — `HDR_TO_SDR` with 7 named tonemap curves, `RETAG` (colorspace tag only), and
  `STRIP_DOVI` (Dolby Vision metadata stripping) — each a declared, closed-vocabulary
  operation, not a raw filter string.
- `qc-skill` (`REPOSITORY_MAP.md`) has concrete typed checks for resolution, fps, codec,
  pixel format, and color metadata as first-class `QCMeasurement`/`QCFinding` fields,
  alongside audio format checks (LUFS/LRA/true-peak, channel layout/balance) and subtitle
  timing checks (SRT/VTT/ASS).

This is real evidence that the ecosystem already reasons about media semantics at a level
above "pass FFmpeg a string" — every one of these fields is a typed, named,
range-checked value in a Skill's own contract (`ffmpeg-skill`'s `_contract.py`-generated
`ToolSpec`, `qc-skill`'s measurement dataclasses), consistent with `ffmpeg-skill`'s own
design principle that "no filter string is ever accepted from a caller" (`REPOSITORY_MAP.md`).

**What the OS adds, and what it explicitly does not:** per `SPEC.md` §1, a Capability
Contract's `input_artifact_types`/`output_artifact_types` and `input_schema`/
`output_schema` fields are exactly where format semantics belong at the OS-contract
level — a Capability like `color.hdr-to-sdr` declares it consumes a `video` Artifact and
produces a `video` Artifact, with the HDR/SDR/tonemap-curve parameters living in its typed
`input_schema`. The OS's job is to make these declarations **discoverable and
comparable across Skills** (the same LSP-style capability-negotiation pattern
`COMPETITIVE_ANALYSIS.md` §6.1 already cites as adopted for Capability discovery
generally) — not to define a canonical format taxonomy of its own, and not to reimplement
what `color-grading-skill` and `qc-skill` already got right. Concretely: the OS never
hardcodes "HDR means BT.2020 PQ" anywhere in a kernel contract; it only requires that a
Skill which *does* know that say so in its published `input_schema`, the same way
`ffmpeg-skill`'s live-introspected `ToolSpec` already works.

**Why this stays a Skill-level concern, not an OS-level media-taxonomy project:** every
current Provider happens to reason about format via FFmpeg's own vocabulary (pixel
formats, colorspace tags, codec names) because every current Provider delegates to
`ffmpeg-skill` (§3 below). Building an OS-level format ontology independent of FFmpeg's
vocabulary today would be designing against a sample size of one underlying engine — the
same objection §3 raises about a media-engine abstraction, applied here to format
taxonomy specifically. The Capability Contract's `input_schema`/`output_schema` fields
are already engine-agnostic in shape (arbitrary typed JSON), so no redesign is needed if
a second engine's format vocabulary ever needs representing — that flexibility already
exists in `SPEC.md` §1's contract shape.

## 3. Media engine abstraction

**Question:** should the OS abstract "media engine" as a first-class concept, given
FFmpeg's ubiquity?

**Evidence:** per `REPOSITORY_MAP.md`, 6 of the 10 skill repos in the "9 skills" framing
delegate execution to `ffmpeg-skill` (`video-editing-skill`, `audio-production-skill`,
`color-grading-skill`, `subtitle-skill` for burn-in, `motion-graphics-skill`,
`thumbnail-skill` for frame extraction) — `qc-skill` and `media-analysis-skill` call
`ffmpeg`/`ffprobe` directly rather than through `ffmpeg-skill`, and `transcription-skill`
uses `faster-whisper` (CTranslate2), not FFmpeg, for its core ASR work. Every path that
touches encode/decode/filter-graph work in this ecosystem ultimately runs FFmpeg.

**Recommendation: NO, not yet. DEFERRED/FUTURE.** `ARCHITECTURE.md` §4 already states the
honest caveat this document adopts unchanged: the ecosystem has real vendor-independence
*of the Skills from each other* (they don't call FFmpeg directly — they delegate through
one shared dependency), but **not yet** independence of the ecosystem from FFmpeg itself,
"because `ffmpeg-skill` is FFmpeg-specific by design and nothing else implements its
contract today." Designing a `MediaEngine` abstraction now — deciding what varies between
engines, what a common capability surface looks like, how filter-graph-shaped operations
generalize to a hypothetical GStreamer or a hypothetical cloud transcoding API — would be
pure speculation against a sample size of one implementation. There is no second engine
anywhere in the ecosystem to abstract *from*; every "abstraction" designed today would be
guessing at what a second implementation would need, which is exactly the "architecture
astronautics" `ARCHITECTURE.md` §9 lens 5 and §10 already rule out project-wide.

**The right eventual seam already exists, and it is not a new primitive.** The
Capability/Provider split (`CAPABILITY_MODEL.md`) is precisely the mechanism that would
absorb a second media engine without inventing anything new: a hypothetical
`gstreamer-skill` would simply **register as another Provider** of Capabilities like
`edit.trim` or `color.hdr-to-sdr` alongside `ffmpeg-skill`-backed Providers
(`video-editing-skill`, `color-grading-skill`), exactly the way `CAPABILITY_MODEL.md`
already describes `qc-skill` and `media-analysis-skill` as two Providers of
`measure.audio.loudness`. The Capability Contract's `input_schema`/`output_schema`
already say nothing FFmpeg-specific at the OS-contract level (§2 above) — a Provider
backed by a different engine would simply publish its own contract satisfying the same
Capability id and artifact types. No `MediaEngine` primitive, registry, or interface is
needed to make this possible; it already falls out of the Capability/Provider model as
specified.

**What this document explicitly does not do:** propose a `MediaEngine` interface, name
candidate methods a second engine would need to implement, or speculate about GStreamer,
a cloud encoding API, or any other specific alternative. `ARCHITECTURE.md` §11's own
final test already states this precisely: "Replace or supplement FFmpeg, does the OS still
make sense? Architecturally yes (Capability/Provider split), practically not proven yet…
no second engine exists today, so this is a design property, not a demonstrated fact."
This document adds nothing to that verdict beyond restating why designing further now
would be premature.

## 4. External application interoperability

**Question:** Premiere, Resolve, Final Cut, Blender, After Effects, DAWs, broadcast
systems, and asset-management systems are all real external tools a production might need
to hand off to or receive from. Should the OS build any of these integrations now, or
lay a neutral foundation for them?

**This document does not propose implementing any integration now** — that is out of
scope per the task and, independently, unsupported by evidence: no audited repo imports,
shells out to, or has any adapter for any of the named applications (`REPOSITORY_MAP.md`
records no such integration anywhere).

**Recommendation: YES to a neutral interchange foundation — and it already exists as a
design, in `TIMELINE_MODEL.md`.** The proposed edit-`Timeline` Artifact
(`TIMELINE_MODEL.md` §3) is explicitly modeled on OpenTimelineIO's clip/track/transition/
marker shape rather than invented from scratch. This document does not redesign or
re-derive that shape — see `TIMELINE_MODEL.md` for the full treatment (naming collision
with the existing Event Timeline, the proposed structure, multi-Skill editing semantics,
branching/merge limitations, and the placement decision that Timeline is an Artifact
type). What this document adds is the interop argument specifically:

- **OTIO already has real adapters for the exact professional formats named in the
  task.** `COMPETITIVE_ANALYSIS.md` §4.1 confirms OpenTimelineIO ships "plugin adapters
  (FCP XML, AAF, CMX EDL) for editorial timeline data" as an Academy Software
  Foundation project — i.e. Final Cut Pro XML, Avid's AAF, and CMX EDL interchange are
  **already solved problems in OTIO's own ecosystem**, not something this project would
  need to build from scratch.
- **Building the OS's Timeline artifact in OTIO's conceptual shape means future interop
  adapters become Provider-style plugins, not new OS-core concepts.** A future
  `premiere-interop-skill` or `resolve-interop-skill` translating OTIO-shaped Timeline
  Artifacts to/from a native project format is architecturally identical to any other
  Skill in this ecosystem: it would declare a Capability (e.g. `timeline.export.fcpxml`
  or `timeline.import.aaf`), take a `timeline` Artifact as input or produce one as output
  (`SPEC.md` §1's `input_artifact_types`/`output_artifact_types`), and register as a
  Provider — exactly the same shape `video-editing-skill` already has for `edit.trim`.
  No new primitive, registry mechanism, or transport is required for this to be possible
  *someday* — the foundation is the Timeline artifact's shape being OTIO-like today, not
  any integration code existing today.
- **Blender, After Effects, DAWs, broadcast systems, and asset-management systems** are
  not addressed by OTIO's timeline-interchange scope specifically (OTIO is an editorial
  timeline format, not a 3D-scene, compositing-project, DAW-session, broadcast-transport,
  or DAM-catalog format) — this document does not claim otherwise. For these, the same
  general principle applies without a specific named prior-art format: **if and when** an
  interop need for one of them is real, it is a Skill (a Provider translating a native
  format to/from an existing Artifact type — `project_ir`, `timeline`, `audio`, or a new
  Artifact type per §6/§10 below) rather than an OS-core concept, following the same
  Capability/Provider seam. This document does not invent format specifics for any of
  them because no audited repo has a concrete need to ground that design in yet — doing so
  now would repeat the same speculative-abstraction mistake §3 rejects for media engines.

**Explicitly rejected: a competing custom Timeline DSL.** `TIMELINE_MODEL.md` already
made this call by choosing OTIO's shape over inventing one; this document confirms and
extends it specifically for the interop question. Inventing a bespoke timeline
representation would mean any future interop adapter has to bridge *two* non-standard
shapes (this project's custom DSL, and whatever the target NLE speaks) instead of one
already-standard shape (OTIO) that the target ecosystem (via OTIO's own adapters) may
already know how to speak to. There is no interoperability argument for a custom DSL that
OTIO's shape does not already satisfy better.

## 5. Multimodal input

**Question:** production intent may arrive as text, voice, video, audio, images, project
files, timelines, metadata, or reference videos. How does the OS handle this?

**Recommendation: the OS does not require every Skill to understand every modality —
this is Agent-layer responsibility, not an OS-kernel concern.** Per `ARCHITECTURE.md` §3's
Agent/OS boundary: "The Agent owns the *logic* that produces a Decision from an
Observation, the planning strategy, **intent interpretation**, and orchestration order,"
while "The OS never imports or depends on Agent logic." Turning a voice memo, a reference
video, or a pile of loose project files into something the OS's typed contracts can act
on is squarely intent interpretation — Agent work, not OS work.

**What the OS needs from this, and no more:** a stable, modality-agnostic **Intent**
contract that the Agent produces *after* normalizing whatever raw multimodal input it
received. This document does not define that contract's shape — `INTENT_MODEL.md`
(authored in parallel with this document) is the authoritative source for it, and this
document defers to it rather than redefining or duplicating it. The property this
document relies on is only the boundary claim: once an Agent has turned voice/video/
reference-material input into a structured Intent + Constraints object, everything
downstream of that point — Capability selection, Plan construction, Operation execution —
operates on the same typed contracts regardless of what modality the original input
arrived in. A Decision, an Operation, and a Plan look identical whether the intent behind
them originated from a typed CLI flag, a transcribed voice note, or an Agent's
interpretation of a reference video's pacing — because by the time they exist, the
Agent has already done the modality-specific work.

**Why the OS should not own modality-specific normalization directly:** none of the
audited repos do this today (`video-production-agent`'s own `providers/base.py` has no
real AI reasoning wired in — `REPOSITORY_MAP.md` — so there is no existing
voice/video/image intent-parsing code to generalize from), and per `ARCHITECTURE.md` §4,
the OS is explicitly Agent-agnostic: "a human, a deterministic rules file, or any LLM
(Claude, GPT, Gemini, local) can drive the same contracts." If the OS itself required
specific multimodal understanding (a bundled speech-to-intent model, a bundled
video-understanding model), that guarantee would break — a different Agent, or a human
using a CLI directly, would be forced through machinery they don't need. Keeping
modality normalization at the Agent layer preserves the same "replace the Agent, does the
OS still make sense?" test `ARCHITECTURE.md` §11 already applies to every other
primitive.

## 6. Multimodal output / artifact typing

**Question:** how does the OS represent the range of things a production can output?

**Already fully covered by `ARTIFACT_MODEL.md`'s type table — not re-derived here.**
`ARTIFACT_MODEL.md` §2 and `SPEC.md` §2 already enumerate `video | audio | image |
subtitle_document | project_ir | qc_report | analysis_result | thumbnail |
production_receipt | timeline`, each grounded against a specific producing Skill in
`REPOSITORY_MAP.md`. The point worth restating for this document's purpose specifically:
**receipts, reports, and metadata are already first-class Artifact types**, not
after-the-fact bookkeeping bolted onto "real" media outputs — `qc_report` (CURRENT,
`qc-skill`'s `QCReport`), `analysis_result` (CURRENT, `media-analysis-skill`'s
observational outputs), and `production_receipt` (PROPOSED, per `CORE_PRIMITIVES.md`
§10) all carry the same identity, lifecycle, and provenance discipline
(`ARTIFACT_MODEL.md` §§1,4,5) as a rendered video file. A production's "output," in this
model, is never assumed to be a single video file — it is whatever set of typed
Artifacts a Plan's DAG terminates in, video, audio, image, document, or report alike.

This document adds nothing to that table beyond noting where a *new* type would fit
(§10, on future media types) and confirming, per `ARTIFACT_MODEL.md` §2's own
"transcription-skill produces a `Transcript`... open gap in the enum" note, that the
type list is already understood by `ARTIFACT_MODEL.md` itself to be incomplete —
consistent with, not contradicted by, §10's recommendation that the enum stay open.

## 7. Accessibility

**Question:** is accessibility (captions, audio description, readable graphics/contrast,
accessibility metadata, delivery compliance) a Skill, a capability family, a QC rule set,
or several of these?

**Recommendation: a capability family spanning existing Skills, not a new monolithic
`accessibility-skill`.** Applying `CAPABILITY_MODEL.md`'s Skill-granularity criteria
directly (§Granularity: "a domain of judgment/parameters that doesn't reduce to typed
operations another Skill already exposes," "a security/execution boundary worth
isolating," "independently testable... without forcing a release of an unrelated
Skill," "more than a thin wrapper"):

- **Captioning already exists and already is an accessibility capability — it does not
  need to be re-homed.** `subtitle-skill`'s `generate` and `render` operations
  (`REPOSITORY_MAP.md`) already provide `subtitle.generate` and (per
  `CAPABILITY_MODEL.md`'s worked examples) implicitly a burn-in capability. Captioning
  *is* an accessibility feature by definition; it already has a Skill, a Capability id,
  and an Artifact type (`subtitle_document`). Nothing here is missing or misplaced.
- **Accessibility-compliance QC checks fit inside `qc-skill`'s existing model as new
  Checks, not a new Skill.** `qc-skill`'s `QCReport`/`QCCheck`/`QCFinding`/`QCMeasurement`
  hierarchy (`CORE_PRIMITIVES.md` §9) is a general verification model, not
  content-specific — it already has a `subtitle` check category (SRT/VTT/ASS timing,
  per `REPOSITORY_MAP.md`) that a future accessibility-compliance check (caption presence,
  caption-to-audio-duration coverage ratio, contrast-ratio measurement on burned-in
  graphics, etc.) would extend rather than replace. This satisfies the granularity
  criteria's negative test directly: these checks are "a single accomplishable thing"
  (a measurement + threshold judgment) that reduces to `qc-skill`'s existing typed
  model, not a new judgment/execution boundary.
- **A future `audio-description-skill` (synthesizing narration of visual content) WOULD
  pass the granularity test — a legitimate future Skill candidate, distinct from
  captioning.** Unlike caption generation (which structurally validates and formats
  already-known text — `subtitle-skill`'s own boundary, per `REPOSITORY_MAP.md`), audio
  description requires **new judgment**: deciding *what* visual content is worth
  describing, *when* to insert narration without colliding with existing dialogue/audio,
  and *how* to phrase a description concisely enough to fit available gaps — a
  domain of judgment/parameters that does not reduce to any existing Skill's typed
  operations. It would also plausibly need its own generative dependency (a
  vision-to-text or captioning model) distinct from `subtitle-skill`'s and
  `transcription-skill`'s dependencies, satisfying the "own security/execution boundary"
  criterion. This is named here as a legitimate candidate for `SKILL_PROPOSAL.md`'s
  review process, not designed further — consistent with this document's mandate not to
  implement or over-specify future work.

**Net shape:** accessibility is not one thing in this taxonomy — it is a cross-cutting
capability family (`subtitle.generate`, `subtitle.render`, a future
`accessibility.audio-description`, future accessibility-specific QC Checks) realized
across `subtitle-skill`, `qc-skill`, and (for audio description specifically) a
legitimately new future Skill — never a single monolithic `accessibility-skill` gathering
unrelated judgment/execution domains under one package, which `CAPABILITY_MODEL.md`'s
"Avoiding both failure modes" section would flag as exactly the wrong shape (a package
that would need to own subtitle timing, video contrast analysis, and narrative narration
generation — three unrelated execution substrates with no shared security boundary, the
same test that already correctly keeps `color-grading-skill` and `subtitle-skill`
separate today).

## 8. Localization

**Question:** subtitle translation, dubbing, voice replacement, typography, locale
formatting, cultural adaptation, and timing changes all touch localization. Where are the
boundaries?

**Recommendation: against one monolithic `localization-skill`, following
`CAPABILITY_MODEL.md`'s explicit warning against exactly this shape.**
`CAPABILITY_MODEL.md`'s "Avoiding both failure modes" section names this scenario
directly: "a proposal for `voice-production-skill`, `dubbing-skill`, and
`localization-skill` as three *separate* Skills should be challenged first against the
criteria above — if all three would delegate 100% of execution to
`ffmpeg-skill`/`transcription-skill` and differ only in default parameter sets, they may
be three Capabilities within one `localization-skill`, not three Skills." This document
applies the same criteria the other direction — checking whether the pieces really are
one Skill's Capabilities, or whether some of them clear the bar for their own Skill —
and finds a mixed answer, not a single one:

- **Subtitle translation is a Capability** (`subtitle.translate`), not a Skill of its
  own. Translating cue text is a bounded, typed transformation (text in a source
  language cue → text in a target language cue, same timing) that reduces cleanly to a
  parameter/operation shape — it does not need its own execution boundary distinct from
  whatever provides the translation (a future Provider, whether a Skill wrapping a
  translation API or model). It could be provided by a future dedicated Skill or by a
  Provider registered under `subtitle-skill`'s existing domain; either is consistent with
  the Capability/Provider split (`CAPABILITY_MODEL.md`) and does not need to be resolved
  in this document.
- **Dubbing / voice replacement earns a legitimately distinct future Skill
  (`dubbing-skill`)** — `CAPABILITY_MODEL.md`'s own worked example names this exact case:
  "`dubbing-skill` would own voice-timing/lip-sync tradeoffs that don't fit inside
  `audio-production-skill`'s typed operation set." This is a genuine new judgment domain
  (deciding how to compress/expand a translated line to fit a source clip's timing
  without breaking lip-sync or naturalness) and plausibly a new execution boundary (a
  TTS/voice-cloning dependency distinct from `audio-production-skill`'s typed
  gain/mix/normalize/dynamics operations) — it clears the granularity bar
  `CAPABILITY_MODEL.md` sets, the same way `motion-graphics-skill` clears it for overlay
  composition rather than being "just different ffmpeg flags."
- **Typography and locale-specific rendering adaptation fit inside `subtitle-skill`'s
  existing domain as new Capabilities, not a new Skill.** Right-to-left text layout,
  locale-specific line-break rules, or region-specific reading-speed thresholds are
  variations on subtitle rendering/formatting — `subtitle-skill` already owns the
  `generate`/`render` domain and the `SubtitleDocument`/`SubtitleCue` typed shape
  (`REPOSITORY_MAP.md`); extending it with locale-aware formatting Capabilities is adding
  Operations/Capabilities within an existing domain, not opening a new
  judgment/execution boundary — precisely the "should remain a Capability, not a new
  Skill" criterion in `CAPABILITY_MODEL.md`.
- **Cultural adaptation** (idiom localization, culturally-specific visual substitutions)
  is, at the level this ecosystem currently operates, mostly a translation-quality
  concern that lives inside `subtitle.translate`'s judgment (a translation Provider's own
  quality, not a separate mechanical step) rather than a distinct Capability with its own
  typed parameter surface — this document does not invent a `culture.adapt` Capability
  because no evidence anywhere in the ecosystem suggests what its typed inputs/outputs
  would even be; naming it as more than a translation-quality property would be
  speculative scope invention of exactly the kind this project's principles reject.

**Net shape:** no single `localization-skill`. Translation is a Capability (home
undecided, and does not need to be decided here); typography/locale formatting are
Capabilities inside `subtitle-skill`; dubbing/voice-replacement is the one piece of
"localization" that earns its own future Skill, because it alone has the new
judgment-domain and new-execution-boundary properties the other pieces lack.

## 9. Delivery architecture and delivery profiles

**Question:** web, social, YouTube, broadcast, archive, cinema, conference, and
internal-review delivery targets each imply different constraints. Is Delivery a Skill,
capability family, profile, or Provider?

**Recommendation: Delivery is a profile — a named, reusable Plan template/constraint-set —
not a new Skill or Capability, and this pattern already exists in the ecosystem
today.** `CORE_PRIMITIVES.md` §11 already states the general principle: "**Pipeline** —
not a separate primitive; per §6, a pipeline is a named, reusable shape of Plan (a
template), not a new kernel concept. `video-production-agent`'s `profiles/` directory
(`generic`, `youtube`, `conference`) is exactly this today." This is **CURRENT** evidence,
not a proposal — `video-production-agent` already ships named delivery-shaped profiles,
and delivery targets in the task's list (YouTube, conference/internal-review) are
literally two of the three profiles that already exist.

**What a delivery profile is, concretely, using only existing primitives:**

- A **name** (`youtube`, `broadcast`, `archive`, `cinema`, `conference`, ...).
- A **constraint set** expressed through the same typed Capability parameter schemas
  §2 already covers — target resolution/codec/container/audio-format values that become
  the `input_schema`/`output_schema` parameters passed to whichever export/render
  Capability a Plan invokes for that target (e.g. `ffmpeg-skill`'s `export`/`render`
  tools, per `REPOSITORY_MAP.md`).
- A **QC rule set** — which `qc-skill` Checks must pass before an Artifact bound for
  that target is promoted to `final` (`ARTIFACT_MODEL.md` §5's lifecycle stages,
  Agent/human-driven promotion). `COMPETITIVE_ANALYSIS.md` §1.2 already names a closely
  related future artifact type worth watching here — a versioned, diffable `qc_policy`/
  `delivery_spec` document (modeled on MediaConch's policy-as-portable-file pattern) —
  which this document does not design further (it is `ARTIFACT_MODEL.md`/
  `COMPETITIVE_ANALYSIS.md` territory, not delivery-specific), but flags as the natural
  future home for a delivery profile's QC rule set once it exists as a first-class,
  versioned document rather than an inline parameter.
- A **selection** of which Capabilities/Operations a Plan needs to run to satisfy the
  target — no new selection mechanism; this is the same Plan-DAG-construction the Agent
  already does for any Plan (`ARCHITECTURE.md` §6).

None of this requires a new primitive: a delivery profile *is* a template that
parameterizes and orders existing Capabilities and QC checks, exactly the way
`CORE_PRIMITIVES.md` §11 already frames "Pipeline."

**Recommendation against a new "Delivery Skill" for now.** No audited repo does
final-mux/container-packaging beyond what `ffmpeg-skill`'s existing `export`/`render`
tools already do (`REPOSITORY_MAP.md`), so there is no unmet execution need a new Skill
would fill — the work a "Delivery Skill" would do (pick codec/container/audio parameters
per target, invoke export, run QC) is exactly Plan-authoring using existing Capabilities,
not a new judgment/execution domain per `CAPABILITY_MODEL.md`'s granularity criteria (it
fails criterion 1 directly: it reduces entirely to typed operations `ffmpeg-skill`
already exposes, with different parameter defaults per target — the same "three
Capabilities within one Skill, not three Skills" pattern §8 already applies to
localization). If a genuinely new execution need emerges later — say, a delivery target
requiring a packaging step no existing Skill can do (broadcast-specific wrapper formats,
DCP packaging for cinema) — that specific gap, not "delivery" as a category, would be
the trigger for a new Skill proposal, evaluated the normal way through
`SKILL_PROPOSAL.md`.

## 10. Future media types and future media/AI technology

This section is deliberately short: the point is that the architecture must not
**preclude** future media types, not that the OS should design for them now — designing
ahead of evidence is exactly the pattern `ARCHITECTURE.md` §9 lens 5 and §10 already rule
out project-wide.

**The Capability/Provider/Artifact model is media-type-agnostic by construction.** Per
`SPEC.md` §1, a Capability's `input_artifact_types`/`output_artifact_types` are declared
types in a contract field, not a hardcoded enum baked into OS logic — nothing in the
Capability Contract shape, the Provider registration mechanism, or the Plan DAG model
(`ARCHITECTURE.md` §6) references "video" or "audio" as special cases with different
handling from any other type. A hypothetical future `3d-composition-skill` producing a
new `scene_3d` Artifact type, or a hypothetical `spatial-audio-skill` producing a
`spatial_audio` Artifact type, would slot into this model exactly the way `thumbnail`
(a specialization the ecosystem already treats as its own type distinct from `image`,
per `ARTIFACT_MODEL.md` §2) already does: declare the type, declare the Capabilities that
produce/consume it, register as a Provider. No OS-core code change is implied by this —
the registry, the Plan-DAG validator, and the Artifact identity/lifecycle model
(`ARTIFACT_MODEL.md` §§1,5) all operate on Artifacts generically, never by
type-specific branches.

**The one precondition this depends on, and it is a gap worth flagging rather than
silently assuming solved:** this only holds if the Artifact type enum in
`ARTIFACT_MODEL.md` is treated as an **open, extensible set**, not a closed, exhaustive
one. `ARTIFACT_MODEL.md` §2 already gestures at this — it explicitly names
`transcription-skill`'s `Transcript`/`SpeechEvent` outputs as "an open gap in the enum...
this document treats that as an open gap in the enum, not evidence that transcripts
aren't Artifacts" — which is consistent with an open-set reading, but `ARTIFACT_MODEL.md`
does not currently state outright, as a general property of the type list, that it is
illustrative and extensible rather than closed and exhaustive. **This document flags that
as a gap for a future editor of `ARTIFACT_MODEL.md` to close explicitly** (a one-sentence
addition stating the enum is open, following the same pattern already used for the
`Capability` id namespace, which `CORE_PRIMITIVES.md` §1 already treats as an open,
growable set of dotted names) — this document does not edit `ARTIFACT_MODEL.md` itself,
since another agent may be working on it concurrently.

**What this document explicitly does not do:** propose schemas for images-as-primary-
output, voice/TTS as a first-class modality, 3D, volumetric capture, spatial audio, or
immersive/XR media, or speculate about what future AI/media technology might require.
None of these have any grounding in `REPOSITORY_MAP.md`'s evidence today, and per this
project's own recurring discipline (§3's media-engine caveat, §4's interop caveat),
designing specifics ahead of a concrete need would be fabricating scope the audit does
not support. The only claim this section makes is the narrower, evidence-grounded one:
the existing model does not need to change shape to accommodate them **provided** the
type enum stays open — which is a documentation fix, not an architectural one.

## Summary

| Question | Verdict | New primitive introduced? |
|---|---|---|
| Media asset graph | It's `derived_from` (Artifact lineage), FUTURE, not a graph DB | No |
| Format/codec abstraction | Already exists per-Skill (typed fields); OS makes it discoverable | No |
| Media engine abstraction | Deferred/FUTURE — Capability/Provider split is the eventual seam | No |
| External NLE/DAW/DAM interop | Neutral foundation = OTIO-shaped `Timeline` (already proposed); adapters are future Skills | No |
| Multimodal input | Agent-layer normalization into a modality-agnostic Intent contract | No |
| Multimodal output | Already `ARTIFACT_MODEL.md`'s type table; receipts/reports are first-class | No |
| Accessibility | Capability family across `subtitle-skill`/`qc-skill`; `audio-description-skill` is a legitimate future Skill | Future Skill candidate named, not created |
| Localization | Split: translation = Capability, dubbing = legitimate future Skill, typography = Capability in `subtitle-skill` | Future Skill candidate named, not created |
| Delivery | Profile/template over existing Capabilities + QC, per `video-production-agent`'s existing `profiles/` | No |
| Future media types | Model is type-agnostic by construction, provided the Artifact type enum stays open (flagged gap) | No |
