# Capability Matrix

Status: **derived entirely from `REPOSITORY_MAP.md`'s evidence.** No capability listed
below is speculative — each row cites the specific operation(s), analyzer(s), or tool
script(s) `REPOSITORY_MAP.md` verified by reading source. Where `REPOSITORY_MAP.md` did
not find a capability (e.g. AI-generated thumbnails, semantic scene understanding), it is
listed under "Explicitly unsupported," never invented as a row.

This is a snapshot, not a registry. No Capability Contract schema exists yet to make this
table a queryable fact instead of a hand-built document — that is `ROADMAP.md` Phase 1.
Capability ids below use the dotted namespace `SPEC.md` §1 proposes
(`skill_id/tool` → `domain.action`); they are **PROPOSED identifiers**, not yet published
by any Skill's contract.

## How to read the lifecycle column

Per `CAPABILITY_MODEL.md`'s 5-state model (`PROPOSED → EXPERIMENTAL → STABLE →
DEPRECATED → RETIRED`), **every row in this table is `EXPERIMENTAL`**, with one
qualification: the Capability *id* itself is technically still `PROPOSED` (no Skill
publishes a `capabilities[].lifecycle` field today — the field doesn't exist yet, per
`CAPABILITY_MODEL.md`'s own admission that Provider/lifecycle are `FUTURE` concepts). Once
Phase 1/2 of `ROADMAP.md` land and Skills actually emit a `lifecycle` value, the honest
default for nearly all of them is `EXPERIMENTAL`, because:

- Every providing Skill repo is version `0.x` (pre-1.0), by its own `skill.version`.
- 10 of 11 repos ship as a single squashed commit with no independent commit history —
  "well-specified initial implementation," not "battle-tested" (`REPOSITORY_MAP.md`
  finding 6).
- `qc-skill`'s and `media-analysis-skill`'s test suites could not be independently run in
  the audit sandbox (`pytest` unavailable) — static review only, not a passing-test
  guarantee.
- No Capability anywhere has graduated through a documented promotion process, because
  that process (and the lifecycle field it promotes) does not exist yet.

Nothing below is marked `STABLE`. That is not pessimism about code quality — several of
these implementations (the ffmpeg-skill delegation pattern in particular, per
`ARCHITECTURE.md` §9 lens 9) are well-designed — it is an honest statement that no
promotion mechanism has ever run.

---

## 1. Editing capabilities — `video-editing-skill` → `ffmpeg-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `edit.trim` | video-editing-skill (`TRIM`) | video-editing-skill → ffmpeg-skill (`cut`) | EXPERIMENTAL | — |
| `edit.cut` | video-editing-skill (`CUT`) | video-editing-skill → ffmpeg-skill (`cut`) | EXPERIMENTAL | — |
| `edit.concat` | video-editing-skill (`CONCAT`, typed transitions) | video-editing-skill → ffmpeg-skill (`join`) | EXPERIMENTAL | — |
| `edit.speed` | video-editing-skill (`SPEED`) | video-editing-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `edit.fit` | video-editing-skill (`FIT`) | video-editing-skill → ffmpeg-skill (`fit`) | EXPERIMENTAL | — |
| `edit.fill` | video-editing-skill (`FILL`) | video-editing-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `edit.resize` | video-editing-skill (`RESIZE`) | video-editing-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `edit.overlay` | video-editing-skill (`OVERLAY`) | video-editing-skill → ffmpeg-skill (`overlay`) | EXPERIMENTAL | Naming note: this is an **editing-domain** overlay (video/PiP-shaped, per `video-editing-skill`'s typed op set). It is a *different* capability from `motion_graphics.overlay` below, which is a graphics/logo overlay owned by a different Skill. Both ultimately call ffmpeg-skill's overlay-family tools, but `REPOSITORY_MAP.md` gives no evidence they are the same capability under one id — do not collapse them without further audit. |

**Explicitly unsupported (declared, not silently approximated) in this domain:**
`CROP, FREEZE, REVERSE, IMAGE_INSERT, POSITION` — `video-editing-skill` raises/rejects
these rather than approximating them (`REPOSITORY_MAP.md`, video-editing-skill section).

---

## 2. Audio capabilities — `audio-production-skill` → `ffmpeg-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `audio.gain` | audio-production-skill (`GAIN`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.trim` | audio-production-skill (`TRIM`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.cut` | audio-production-skill (`CUT`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.silence_remove` | audio-production-skill (`SILENCE_REMOVE`) | audio-production-skill → ffmpeg-skill (`silence`) | EXPERIMENTAL | Explicit ranges only — no silence *detection* built in; detection is a separate `measure.audio.silence` capability (§4), composed by the caller, not this Skill. |
| `audio.fade` (in/out) | audio-production-skill (`FADE_IN`, `FADE_OUT`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.normalize` | audio-production-skill (`NORMALIZE`, EBU R128) | audio-production-skill → ffmpeg-skill (`loudness`) | EXPERIMENTAL | — |
| `audio.mix` | audio-production-skill (`MIX`) | audio-production-skill → ffmpeg-skill (`audio`) | EXPERIMENTAL | — |
| `audio.mono` | audio-production-skill (`MONO`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.stereo` | audio-production-skill (`STEREO`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.downmix` | audio-production-skill (`DOWNMIX`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.noise_reduction` | audio-production-skill (`NOISE_REDUCTION`) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.dynamics` | audio-production-skill (`DYNAMICS`: gate→compressor→limiter chain) | audio-production-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `audio.concat` | audio-production-skill (`CONCAT`) | audio-production-skill → ffmpeg-skill (`join`) | EXPERIMENTAL | — |

**Explicitly unsupported (declared) in this domain:** `CHANNEL_MAP, RESAMPLE,
FORMAT_CONVERT` — `audio-production-skill` refuses these rather than approximating them
(`REPOSITORY_MAP.md`, audio-production-skill section).

---

## 3. Color capabilities — `color-grading-skill` → `ffmpeg-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `color.hdr_to_sdr` | color-grading-skill (`HDR_TO_SDR`, 7 tonemap curves) | color-grading-skill → ffmpeg-skill (`color`) | EXPERIMENTAL | — |
| `color.lut_apply` | color-grading-skill (`LUT_APPLY`) | color-grading-skill → ffmpeg-skill (`color`) | EXPERIMENTAL | LUT files are validated against a *separate* path allowlist from input-media roots — a security detail, not a capability limit, but worth carrying into `SECURITY_MODEL.md`. |
| `color.retag` | color-grading-skill (`RETAG`, colorspace tag only, no pixel rewrite) | color-grading-skill → ffmpeg-skill | EXPERIMENTAL | — |
| `color.strip_dovi` | color-grading-skill (`STRIP_DOVI`) | color-grading-skill → ffmpeg-skill | EXPERIMENTAL | — |

**Explicitly unsupported (declared, raises `UNSUPPORTED_OPERATION`, never approximated)
in this domain:** `EXPOSURE, CONTRAST, SATURATION, TEMPERATURE, TINT, WHITE_BALANCE,
GAMMA, LIFT, GAIN, LEVELS, CURVES` — i.e. `color-grading-skill` today does technical/
delivery color operations only, honestly, not creative grading
(`REPOSITORY_MAP.md`, color-grading-skill section).

---

## 4. Subtitle capabilities — `subtitle-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `subtitle.generate` | subtitle-skill (`generate`) | subtitle-skill → **[self]** (writes SRT/WebVTT directly from a typed `SubtitleDocument`; no video I/O, no ffmpeg call at all) | EXPERIMENTAL | Does not perform ASR. Consumes an already-built `SubtitleDocument`/`SubtitleCue`; transcription is a separate capability (`transcribe.audio`, §6) composed at the Plan/Agent level, not a Skill dependency (`REPOSITORY_MAP.md` explicitly confirms zero ASR code and zero `transcription-skill` dependency here). |
| `subtitle.render` (burn-in) | subtitle-skill (`render`) | subtitle-skill → ffmpeg-skill (`caption`) | EXPERIMENTAL | SRT only; ASS/SSA burn-in not implemented. |

**Explicitly unsupported / not implemented:** `convert`, standalone `validate`, `offset`,
`merge`, ASS/SSA support.

**Security note carried into this matrix (not a capability limit, a known gap):**
`subtitle-skill`'s cue-text validation is structural only (control characters, line
length, reading speed) — no defense exists against cue text later being fed into an LLM
prompt unsanitized by a downstream Agent step. This is a live, present finding
(`REPOSITORY_MAP.md`, subtitle-skill section; `ARCHITECTURE.md` §7), not hypothetical.

---

## 5. Motion graphics capabilities — `motion-graphics-skill` → `ffmpeg-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `motion_graphics.title_card` | motion-graphics-skill | motion-graphics-skill → ffmpeg-skill (`graphics`) | EXPERIMENTAL | — |
| `motion_graphics.lower_third` | motion-graphics-skill (built-in fade/slide templates only) | motion-graphics-skill → ffmpeg-skill (`graphics`) | EXPERIMENTAL | Templates are fixed/built-in, not user-authorable animation. |
| `motion_graphics.overlay` | motion-graphics-skill (free-form text, image/logo overlay) | motion-graphics-skill → ffmpeg-skill (`overlay`, `probe`) | EXPERIMENTAL | Image/logo overlay supports linear fade only — no scale/slide animation. See §1's naming note distinguishing this from `edit.overlay`. |

Built entirely on ffmpeg-skill's `graphics`/`overlay`/`probe` tools — not Remotion, not
Lottie, not After Effects (`REPOSITORY_MAP.md`). `motion-graphics-skill`'s own
architecture doc explicitly lists MCP among things it deliberately does not do.

---

## 6. Thumbnail capabilities — `thumbnail-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `thumbnail.render` | thumbnail-skill (`render`) | thumbnail-skill → **[Pillow]** (raster compositing; "never touches ffmpeg" for this step) | EXPERIMENTAL | The only repo in the ecosystem with a real third-party pip dependency (`Pillow>=10.0`). |
| `thumbnail.extract_frame` | thumbnail-skill (`extract_frame`) | thumbnail-skill → ffmpeg-skill (`look`, `probe`) | EXPERIMENTAL | Delegates only the one video-decoding step it needs. |

**Explicitly unsupported (declared, refused by design):** no AI-generated thumbnails, no
"best-frame" selection, no face detection.

---

## 7. Transcription capabilities — `transcription-skill`

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Unsupported-in-domain note |
|---|---|---|---|---|
| `transcribe.audio` | transcription-skill (`faster-whisper` engine, via internal `engines/registry.py`) | transcription-skill → **faster-whisper** (CTranslate2 Whisper; no other Skill dependency) | EXPERIMENTAL | No diarization (`speaker_id` always null). No cloud ASR path — `docs/decisions.md` ADR-002 states this was a deliberate choice, not an oversight (`REPOSITORY_MAP.md`). |

Not in the task brief's original "9 skills" list, but a real, active ecosystem member —
`subtitle-skill`'s README and `video-production-agent`'s integration CI both reference it.
Direct evidence the ecosystem's skill count is not fixed.

---

## 8. Measurement capabilities — `qc-skill` and `media-analysis-skill`

This is the section containing the ecosystem's one confirmed **Capability collision**
(`CAPABILITY_MODEL.md` §"Capability Collision"; `REPOSITORY_MAP.md` finding 2).

### 8a. Collision rows — both Skills independently implement the same measurement

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Note |
|---|---|---|---|---|
| `measure.audio.loudness` | **qc-skill** (`measurements/audio.py`, `ebur128` — LUFS/LRA/true-peak) **AND media-analysis-skill** (`analyzers/loudness.py`, also `ebur128`, independently parsed) | qc-skill; media-analysis-skill | EXPERIMENTAL | **⚠ COLLISION.** Two independent Providers of the same Capability id, with no shared library and no registry today to notice this is duplication rather than divergent design (`REPOSITORY_MAP.md` finding 2; `CAPABILITY_MODEL.md`'s motivating example). Under `CAPABILITY_MODEL.md`'s collision policy, both must register as explicit Providers; resolution is Plan-time explicit choice → default-provider policy → registry refusal (never silent first-match). |
| `measure.audio.silence` | **qc-skill** (`silencedetect`) **AND media-analysis-skill** (`silence` analyzer) | qc-skill; media-analysis-skill | EXPERIMENTAL | **⚠ COLLISION**, same shape as above — independently implemented, no shared identity. |
| `measure.audio.integrity` | **qc-skill** (decode-integrity check + `_decode_errors.py`) **AND media-analysis-skill** (`integrity`: full decode via `-f null`, decode-error/frame-count/timestamp checks) | qc-skill; media-analysis-skill | EXPERIMENTAL | **⚠ COLLISION**, same shape as above. |

**Important asymmetry (per `REPOSITORY_MAP.md`):** awareness of the overlap is
one-directional. `qc-skill`'s own docs explicitly reference and position against
`media-analysis-skill`. `media-analysis-skill`'s docs and code contain **zero**
references to `qc-skill`, despite acknowledging overlap with `ffmpeg-skill` by name and
stating "which of the two a production system uses... is the agent's choice." This is not
a strict superset/subset relationship either — see 8b.

### 8b. qc-skill-only measurements (media-analysis-skill does not implement these)

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Note |
|---|---|---|---|---|
| `measure.video.freeze` | qc-skill (`freezedetect`-based check) | qc-skill only | EXPERIMENTAL | Confirmed absent in media-analysis-skill — not a second silent duplicate; the two Skills are **not** a strict superset/subset pair. |
| `measure.video.black_frame` | qc-skill (`blackdetect`) | qc-skill only | EXPERIMENTAL | Same — confirmed absent elsewhere. media-analysis-skill's own scope statement explicitly excludes "freeze-frame detection, black-frame detection" by design. |
| `measure.audio.clipping_and_dynamics` | qc-skill (LRA/true-peak via `ebur128`, clipping) | qc-skill only | EXPERIMENTAL | media-analysis-skill's loudness analyzer does not cover clipping/true-peak/LRA as a distinct check. |
| `measure.audio.channel_layout` | qc-skill (channel layout/balance check) | qc-skill only | EXPERIMENTAL | — |
| `measure.video.format` | qc-skill (resolution/fps/codec/pixel format/color metadata) | qc-skill only | EXPERIMENTAL | Overlaps in *spirit* with media-analysis-skill's `video_format`/`stream_layout` (8c) but is a QC pass/fail judgment against thresholds, not a raw probe — treat as a related-but-distinct capability, not the same id, pending further audit. |
| `measure.subtitle.timing` | qc-skill (SRT/VTT/ASS timing only — no semantic/wording checks) | qc-skill only | EXPERIMENTAL | — |
| `measure.delivery.integrity` | qc-skill (composition of the above + container/size/extension) | qc-skill only | EXPERIMENTAL | This is qc-skill's `QCReport` for the "delivery" check group — a composed judgment, not a new raw measurement. |

### 8c. media-analysis-skill-only measurements (qc-skill does not implement these)

| Capability id (proposed) | Provider(s) | Skill(s) | Lifecycle | Note |
|---|---|---|---|---|
| `measure.video.scene_detection` | media-analysis-skill (ffmpeg `scdet`) | media-analysis-skill only | EXPERIMENTAL | Explicitly **"not semantic scenes"** per its own README — a hard-cut/shot-boundary detector, not content understanding. No AI. |
| `measure.video.timing` (A-V sync) | media-analysis-skill (`timing`: packet-gap/A-V sync) | media-analysis-skill only | EXPERIMENTAL | — |
| `measure.media.probe` | media-analysis-skill (`media_probe`: container format, duration, size, bitrate, video/audio summary — one ffprobe call) | media-analysis-skill only | EXPERIMENTAL | **RESOLVED 2026-09-05** (was an open, bundled placeholder — see history below): named `media`, not `video`, because this kind reports container-level facts across both stream types, not a video-specific measurement. |
| `measure.media.stream_layout` | media-analysis-skill (`stream_layout`: every stream — index, type, codec, language, disposition, dimensions, rate, channels) | media-analysis-skill only | EXPERIMENTAL | **RESOLVED 2026-09-05.** Enumerates *all* streams (video, audio, subtitle), so `media`, not `video` or `audio`. |
| `measure.video.probe` | media-analysis-skill (`video_format`: resolution, fps, frame count, pixel format, colour, SAR/DAR, CFR/VFR of one video stream) | media-analysis-skill only | EXPERIMENTAL | **RESOLVED 2026-09-05.** Deliberately *not* `measure.video.format`: that id is qc-skill's own (§8b) for a pass/fail judgment against caller-supplied thresholds — this is a raw, threshold-free probe, a different capability in kind, not degree (confirmed by re-reading both implementations: qc-skill's check compares against an expected value and emits PASS/FAIL/WARN; media-analysis-skill's analyzer only reports the measured value). `probe`, not `format`, marks that distinction in the id itself so the two are never mistaken for the same thing later. |
| `measure.audio.probe` | media-analysis-skill (`audio_format`: sample rate, channels, layout, codec, sample format, bitrate of one audio stream) | media-analysis-skill only | EXPERIMENTAL | **RESOLVED 2026-09-05.** Same reasoning as `measure.video.probe` above, for audio. |
| `measure.media.duration` | media-analysis-skill (`duration`: per-stream durations and start times only — a strict subset of `media_probe`'s facts, with no packet-level timestamp analysis) | media-analysis-skill only | EXPERIMENTAL | **RESOLVED 2026-09-05.** Distinct from `measure.video.timing` (A-V sync, above): `duration`'s analyzer (`TimingAnalyzer.analyze`, `kind == "duration"`) returns only `_durations(p)` and does no packet-timestamp work at all; `timing` additionally runs `run_packets`/`timestamp_report`/`av_mismatch`. Kept as its own Capability id, consistent with every other analysis kind in this ecosystem getting one, rather than folded into `measure.media.probe` even though it reports a subset of the same underlying facts. |

**History — why these five were unassigned until now:** all five are ffprobe-only and
purely observational (`REPOSITORY_MAP.md`); until this resolution they were kept as one
bundled, unpinned note (`measure.video.probe` / `measure.*.format` / `measure.*.duration`)
specifically because guessing individual ids risked colliding with `measure.video.format`
above (qc-skill's own id) or with `ffmpeg-skill`'s base-layer `probe` tool
(`ffmpeg-skill.probe`, §9) — two different, unrelated risks that both needed to be ruled
out by direct code comparison before assigning anything, not assumed away. Both are now
confirmed false: `ffmpeg-skill`'s `probe.py` is a base-layer *tool* overlap, not a
Capability collision — `media-analysis-skill` talks to `ffprobe` directly and does not
depend on the `ffmpeg-skill` package, so there is no shared identity to collide under,
and the two namespaces (`measure.*` vs. `ffmpeg-skill.*`) never overlap by construction;
and `measure.video.format`/`measure.video.probe` were confirmed to measure different
things (a threshold judgment vs. a raw value) by reading both implementations, not by
assumption. This is what unblocked assigning real ids above instead of continuing to
defer the decision.

**Explicitly out of scope for media-analysis-skill (by design, per its own docs):**
freeze-frame detection, black-frame detection, semantic/content understanding, speaker
detection, transcription, captions, thumbnails. "No AI." Confirmed no media-writing code
path exists anywhere in its CLI or schemas — purely observational.

---

## 9. Base-layer capabilities — `ffmpeg-skill`'s 21 raw tools

`ffmpeg-skill` is the ecosystem's foundational execution boundary (`REPOSITORY_MAP.md`).
Its 21 typed, `argparse`-introspected CLI scripts are Capabilities **in their own right**,
independent of the higher-level Skills that delegate to them — an Agent (or a human via
CLI) may invoke any of these directly without going through `video-editing-skill` etc.

| Tool (= base capability id `ffmpeg-skill.<tool>`) | Provider | Lifecycle | Note |
|---|---|---|---|
| `cut` | ffmpeg-skill | EXPERIMENTAL | Underlies `edit.trim`/`edit.cut`. |
| `fit` | ffmpeg-skill | EXPERIMENTAL | Underlies `edit.fit`. |
| `caption` | ffmpeg-skill | EXPERIMENTAL | Underlies `subtitle.render` (burn-in). |
| `overlay` | ffmpeg-skill | EXPERIMENTAL | Underlies `edit.overlay` and `motion_graphics.overlay`. |
| `graphics` | ffmpeg-skill | EXPERIMENTAL | Underlies `motion_graphics.title_card`/`lower_third`. |
| `sync` | ffmpeg-skill | EXPERIMENTAL | No higher-level Skill confirmed consuming this by name in `REPOSITORY_MAP.md` — treat as available-but-unmapped. |
| `multicam` | ffmpeg-skill | EXPERIMENTAL | `video-production-agent` registers a multicam/conference pipeline body but it is `implemented=False` there — the ffmpeg-skill tool itself is the only confirmed-real multicam capability today. |
| `audio` | ffmpeg-skill | EXPERIMENTAL | Underlies `audio.mix` and related audio-production-skill ops. |
| `loudness` | ffmpeg-skill | EXPERIMENTAL | Underlies `audio.normalize` (EBU R128). |
| `silence` | ffmpeg-skill | EXPERIMENTAL | Underlies `audio.silence_remove` (explicit-range removal, not detection). |
| `join` | ffmpeg-skill | EXPERIMENTAL | Underlies `edit.concat` and `audio.concat`. |
| `color` | ffmpeg-skill | EXPERIMENTAL | Underlies all of §3's color capabilities. |
| `export` | ffmpeg-skill | EXPERIMENTAL | Delivery/export packaging — no higher-level Skill confirmed as sole consumer. |
| `check` | ffmpeg-skill | EXPERIMENTAL | Not confirmed identical to `qc-skill`'s checks — qc-skill talks to `ffmpeg`/`ffprobe` directly, not via this tool. |
| `scenes` | ffmpeg-skill | EXPERIMENTAL | Not confirmed identical to media-analysis-skill's `scene_detection` — media-analysis-skill talks to `ffmpeg`/`ffprobe` directly, not via this tool. |
| `look` | ffmpeg-skill | EXPERIMENTAL | Underlies `thumbnail.extract_frame`. |
| `render` | ffmpeg-skill | EXPERIMENTAL | — |
| `probe` | ffmpeg-skill | EXPERIMENTAL | Underlies `thumbnail.extract_frame`'s probing step; see §8c's base-layer-overlap note re: media-analysis-skill's independent ffprobe use. |
| `batch` | ffmpeg-skill | EXPERIMENTAL | The **only** ffmpeg-skill tool with any caching (`idempotency_hint: "cached"`) — every other tool is uncached. |
| `report` | ffmpeg-skill | EXPERIMENTAL | — |
| `verify` | ffmpeg-skill | EXPERIMENTAL | The **only** ffmpeg-skill tool with a per-run timeout enforced — the other 20 main scripts have no per-encode timeout, an honest, present gap (`REPOSITORY_MAP.md`). |

**Cross-cutting facts about this layer (from `REPOSITORY_MAP.md`, load-bearing for the
matrix above):**

- No filter string is ever accepted from a caller for any of these 21 tools — typed flags
  are individually range-checked and converted into filter-graph fragments internally.
- The manifest's `not_provided` field explicitly lists: `AI reasoning, decisions,
  production plans, project IR, approvals, network access, transcription engine`.
- `ffmpeg-skill` is the only repo in the ecosystem shipping an actual MCP server; its
  `tools/list` is generated live from the same contract generator used by its CLI — no
  hand-written schema to drift.
- `mutates_input: false` is declared/enforced for every one of the 21 tools.
- Two version axes exist per tool set: `skill.version` (0.9.1, changes every release) and
  `contract_version` ("1.0", bumps only on breaking `ToolSpec` shape change).

---

## Summary count

- **8 editing** capabilities (video-editing-skill → ffmpeg-skill)
- **13 audio** capabilities (audio-production-skill → ffmpeg-skill)
- **4 color** capabilities (color-grading-skill → ffmpeg-skill)
- **2 subtitle** capabilities (subtitle-skill, one self-contained, one delegated)
- **3 motion-graphics** capabilities (motion-graphics-skill → ffmpeg-skill)
- **2 thumbnail** capabilities (thumbnail-skill, one self-contained via Pillow, one
  delegated)
- **1 transcription** capability (transcription-skill → faster-whisper)
- **17 measurement** capabilities across qc-skill and media-analysis-skill, of which
  **3 are confirmed collisions** (§8a), **7 are qc-skill-exclusive** (§8b), and
  **7 are media-analysis-skill-exclusive** (§8c: `scene_detection`, `timing`, and five
  resolved 2026-09-05 — `media.probe`, `media.stream_layout`, `video.probe`,
  `audio.probe`, `media.duration` — each individually confirmed to carry only a
  base-layer *tool* overlap note with `ffmpeg-skill`, never a Capability-level collision)
- **21 base-layer** capabilities directly exposed by ffmpeg-skill's own tool scripts

**Total distinct rows: 71**, all `EXPERIMENTAL`, zero `STABLE`, zero registered
`Provider` collisions resolved (the 3 in §8a are flagged, not yet resolved — that is
`ROADMAP.md` Phase 3's job).

---

## 10. Support Envelope — a queryable pre-planning artifact (PROPOSED)

Everything above this section is **documentation**: a hand-built table, derived by a
human (or an audit) reading source code, of which Capabilities exist in the ecosystem in
principle and which Skill(s) theoretically provide them. It answers "what has anyone ever
built." It does not, and cannot, answer a different and more operationally useful
question: **"on this specific installed OS instance, right now, which of these
Capabilities can I actually use?"** — given whatever Skills happen to be installed on
this machine, whatever external binaries (`ffmpeg`, `ffprobe`, a specific `faster-whisper`
model weight) happen to be present, and whatever each installed Skill's own
environment-capability check currently reports. This section proposes a distinct, closely
related concept for that second question: the **Support Envelope**.

### 10.1 What it is

A **Support Envelope** is a machine-readable, **queryable** snapshot — an actual runtime
query response, not a document like this one — of which Capabilities are `AVAILABLE`
(not merely documented as existing somewhere in the ecosystem) on one installed OS
instance, and which registered Provider(s) of each are actually usable given what is
installed on that machine right now.

### 10.2 It is not a new mechanism — it is an aggregation of an existing one

This is the load-bearing point: **the Support Envelope invents no new capability-detection
machinery.** `SKILL_SPEC.md` §1 already establishes, as a **CURRENT** pattern verified
across the whole ecosystem, that every one of the 10 audited Skill repos ships **a
`doctor`/environment-capability-check command** — "reports, per capability the Skill
declares, whether it is `AVAILABLE` or `MISSING` and why (missing binary, missing optional
dependency, unmet OS requirement)" (`SKILL_SPEC.md` §3; the pattern is named for
`ffmpeg-skill`'s own `doctor` report and generalized from there, per `CORE_PRIMITIVES.md`
§3's Provider discussion and `CAPABILITY_MODEL.md` §Provider). This is real, present,
per-Skill infrastructure — not a proposal. A Support Envelope is nothing more than the
**aggregation** of every installed Skill's existing `doctor --json` output into one
consolidated response, so an Agent can ask "is Capability X actually usable before I build
a Plan that needs it" as **one query**, instead of shelling out to `doctor` on N separate
Skill CLIs and reconciling the results itself.

### 10.3 What is CURRENT vs. what is FUTURE here

- **CURRENT:** the per-Skill `doctor` data this would aggregate. Every audited Skill
  already reports its own AVAILABLE/MISSING status per capability it declares
  (`SKILL_SPEC.md` §1, §3). This is the real, existing precedent the Support Envelope
  builds on — nothing about the underlying data source is being proposed here.
- **FUTURE — the aggregation itself.** No repository in the 11-repo ecosystem consolidates
  these per-Skill reports into one response today. The closest thing that exists,
  `video-production-agent`'s own capability-checking (`capabilities/resolver.py`'s
  AVAILABLE/MISSING probing and `SkillRegistry.select_tool()`'s per-capability adapter
  lookup, per `REPOSITORY_MAP.md`), checks adapters and capabilities **individually, one
  at a time, as a Plan is being built** — not via one consolidated, queryable Support
  Envelope response covering every installed Skill at once. Building that aggregation
  (a registry-side fan-out over every installed Skill's `doctor --json`, cached and
  re-queryable) is genuinely new work; nothing in the audit shows it exists anywhere yet.

### 10.4 Illustrative shape (not a spec — this is one query, not this whole matrix)

A Support Envelope query response might look structurally like this. This is illustrative
only, intentionally under-specified — the exact schema is `ROADMAP.md`/`SPEC.md` work, not
settled here:

```json
{
  "queried_at": "2026-09-05T00:00:00Z",
  "capabilities": [
    {
      "capability_id": "measure.audio.loudness",
      "available": true,
      "providers": [
        { "provider_id": "qc-skill", "available": true },
        { "provider_id": "media-analysis-skill", "available": true }
      ]
    },
    {
      "capability_id": "transcribe.audio",
      "available": false,
      "providers": [
        {
          "provider_id": "transcription-skill",
          "available": false,
          "reason_if_not": "faster-whisper model weights not found on this machine"
        }
      ]
    }
  ]
}
```

### 10.5 Why this belongs in this document, and why it is not this document

`CAPABILITY_MATRIX.md` (§§1–9 above) is the closest thing to a Support Envelope that
exists today, and it is explicitly **not** one — its own header already says so ("This is
a snapshot, not a registry"). The Support Envelope is what this document would become
queryable *as*, once `ROADMAP.md`'s Capability registry work (§Provider,
`CAPABILITY_MODEL.md`) lands: the same rows, but answered by live `doctor` data from one
specific machine's installed Skills instead of by an audit reading source code once. It is
named here, next to the static matrix, precisely so the two are never confused: this
document is documentation of what the ecosystem *can theoretically do*; the Support
Envelope, once built, is a live answer to what *this installed instance can do right now*.
