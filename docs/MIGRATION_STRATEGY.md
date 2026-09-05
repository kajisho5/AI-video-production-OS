# Migration Strategy

Status: **mechanics document.** This is a companion to `ROADMAP.md`, not a duplicate of
it. `ROADMAP.md` answers *what* gets built and *when* (Phase 0–8, dependency chain,
risk ratings). This document answers a narrower question `ROADMAP.md` deliberately
leaves at the phase-summary level: **for each of the 11 real repos, concretely, what
changes in that repo's own code and interface, in what order, such that the repo never
stops working for its existing callers at any point along the way?** Where this
document names a phase, it is citing `ROADMAP.md`'s phase, not redefining it.

Every claim about what a repo does today is `REPOSITORY_MAP.md`'s evidence, cited
inline. Every claim about what a repo should publish is `SPEC.md` §1's
`CapabilityContract` shape and `CAPABILITY_MATRIX.md`'s proposed capability ids for that
repo. Nothing below invents new capability scope for any Skill — the CURRENT column is
what `REPOSITORY_MAP.md` already verified; the TARGET column only ever adds a discovery
contract on top of it.

## Why this is not a rewrite

**Big Bang Rewrite is rejected, explicitly, not by default.** The task brief's implicit
alternative — replace the 11 repos' current interfaces wholesale with OS-native ones in
one coordinated cutover — is rejected for a concrete reason, not a general preference for
caution: `REPOSITORY_MAP.md` records a self-reported "real-Skill integration 44/44,
evals 99/99" for `video-production-agent`'s current pipeline against the current Skill
interfaces. That number was **not independently re-run** (`REPOSITORY_MAP.md`'s own
"Explicit UNKNOWNs" section says so plainly), and this document does not treat it as
verified ground truth. But "not independently verified" is not the same claim as "not
evidence" — it is still the only evidence that exists, and it is evidence of a working,
tested system. Rewriting working, tested code in the absence of a concrete, named defect
is exactly the "unjustified change" `ARCHITECTURE.md`'s own guiding principle (§2, and
§9 lens 1's "no abstraction without concrete value") argues against everywhere else in
this project — there is no reason to suspend that principle specifically for the
migration mechanics. The correct response to "self-reported, not independently verified"
is to *re-establish a verified baseline before changing anything load-bearing*
(`ROADMAP.md` Phase 3 says this explicitly for `SkillRegistry.select_tool()`), not to
discard the thing being measured.

**The alternative this document commits to: small, independently reviewable, per-repo
PRs.** This is not merely lower-risk in the abstract — it is the one place in this whole
project's roadmap where the evidence directly supports parallelism. `ROADMAP.md` Phase 2
names itself "the one clear exception" to an otherwise strictly sequential roadmap:
because each Skill's contract retrofit touches only that Skill's own `contract.py` output
and shares no mutable state with any other Skill's retrofit, 10 independent PRs (one per
Skill, `ffmpeg-skill` included) can land in any order, by any contributor, without a
merge race. A Big Bang cutover would force exactly the shared-mutable-state coordination
problem Phase 2's parallelism deliberately avoids.

## The mechanism this strategy relies on: two-axis versioned contracts (already exists)

This document does not introduce a new backward-compatibility mechanism. `VERSIONING.md`
§1 already generalizes a proven, working pattern — `ffmpeg-skill`'s
`skill.version`/`contract_version` split, verified moving independently through real
releases (`skill.version` 0.8.3 → 0.9.1 while `contract_version` stayed frozen at
`"1.0"`) — into the OS-wide rule every migration step below depends on:

- A Skill's **`skill.version`** changes on every release, including the additive changes
  this migration makes to its `contract.py` output. This never breaks a caller, because
  nothing outside the Skill's own release process pins against it.
- A Skill's **`contract_version`** changes only when the *shape* a dependent must react
  to changes (`VERSIONING.md` §3's breaking/non-breaking list). Every migration step in
  this document — adding `capabilities[].lifecycle`, `capabilities[].id`,
  `security.forbidden_keys`, `dependencies[]`, `not_provided[]` to an existing
  `contract.py`'s output — is **adding a field with a value, never removing or narrowing
  one**. Per `VERSIONING.md` §3, that is non-breaking by definition and requires no
  `contract_version` bump at all. This is the single fact that makes "almost every Skill's
  bridge is just extend the contract output" true rather than aspirational: the versioning
  mechanism that makes an additive change safe already exists and is already proven in
  production inside this exact ecosystem.

No new mechanism is proposed here for what already works. What this document adds is the
operational discipline for *removing* a bridge once it is no longer needed — see
"Retiring a compatibility layer," below.

## Per-repo migration paths: the 9 Skills where the bridge is genuinely simple

For nine of the ten non-orchestrator repos, the pattern is identical and is stated once
here rather than nine times: **the existing CLI/subprocess interface, the
`FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` enforcement, and the `PathPolicy` symlink-resolved
containment check do not change at all.** The only change is that the JSON object the
Skill's existing `contract` command already emits gains new fields. No script, no
adapter module, no security check, no test is touched. This is `ROADMAP.md` Phase 2's own
characterization ("mostly additive... every Skill already has the underlying mechanism;
this only extends its output format") and is not restated differently here.

| Skill | CURRENT (`REPOSITORY_MAP.md`) | COMPATIBILITY BRIDGE | TARGET | DEPRECATION |
|---|---|---|---|---|
| **`ffmpeg-skill`** | 21 typed stdlib `argparse` scripts; `scripts/_contract.py` introspects a live `ToolSpec` per script; ships the ecosystem's only real MCP server, generated from the same contract; two-axis versioning already proven (`skill.version` 0.9.1, `contract_version` "1.0"); explicit `not_provided` manifest. | Extend `_contract.py`'s generated `ToolSpec` output with `capabilities[].id` (dotted, e.g. `ffmpeg-skill.cut` — `CAPABILITY_MATRIX.md` §9), `capabilities[].lifecycle` (`EXPERIMENTAL` initially, per `CAPABILITY_MODEL.md`), and a `security.forbidden_keys` echo of the denylist already enforced. Because the generator introspects `argparse` live, this is a generator-code change, not per-script edits — the lowest-risk retrofit in the ecosystem, per `ROADMAP.md` Phase 2. CLI, MCP server, `FORBIDDEN_KEYS`, no-timeout-except-`verify` gap — unchanged. | Each of the 21 tools is a discoverable, registry-resolvable Capability/Provider pair instead of an implicitly-known dependency every other Skill's adapter locates via env-var-then-well-known-path. | N/A — nothing removed. `not_provided` stays authoritative. |
| **`video-editing-skill`** | Typed `TRIM/CUT/CONCAT/SPEED/FIT/FILL/RESIZE/OVERLAY`; single designated adapter module, AST-walk-verified as the only subprocess launch site; `contract_version` range-checked against `ffmpeg-skill` at startup. | Extend `contract.py` output with `capabilities[].id` (`edit.trim`, `edit.cut`, `edit.concat`, … — `CAPABILITY_MATRIX.md` §1), `lifecycle`, and `dependencies: [{skill_id: "ffmpeg-skill", version_range}]` reflecting the `SUPPORTED_MIN`/`SUPPORTED_MAX` check that already exists in code. Adapter module, AST-walk test, `PathPolicy` — unchanged. | Registry-discoverable Provider of `edit.*` capabilities; the OS registry resolves the `ffmpeg-skill` dependency instead of the adapter's own env-var/well-known-path search being the only mechanism. | N/A. `CROP/FREEZE/REVERSE/IMAGE_INSERT/POSITION` stay explicitly unsupported (declared, not silently approximated). |
| **`audio-production-skill`** | Typed `GAIN/TRIM/CUT/SILENCE_REMOVE/FADE_IN/FADE_OUT/NORMALIZE/MIX/MONO/STEREO/DOWNMIX/NOISE_REDUCTION/DYNAMICS/CONCAT`; same single-adapter, AST-walk-verified pattern as video-editing-skill. | Same shape as video-editing-skill: add `capabilities[].id` (`audio.gain`, `audio.normalize`, … — `CAPABILITY_MATRIX.md` §2), `lifecycle`, `dependencies` on `ffmpeg-skill`. Nothing else changes. | Registry-discoverable Provider of `audio.*` capabilities. | N/A. `CHANNEL_MAP/RESAMPLE/FORMAT_CONVERT` stay explicitly unsupported. |
| **`color-grading-skill`** | Typed `HDR_TO_SDR/LUT_APPLY/RETAG/STRIP_DOVI`; delegates to `ffmpeg-skill`'s `color` tool; a *separate* path allowlist for LUT files vs. input-media roots. | Add `capabilities[].id` (`color.hdr_to_sdr`, `color.lut_apply`, `color.retag`, `color.strip_dovi` — `CAPABILITY_MATRIX.md` §3), `lifecycle`, `dependencies`. The LUT-file allowlist is a security detail of the existing `PathPolicy`, unaffected by a contract-shape change. | Registry-discoverable Provider of `color.*`. | N/A. `EXPOSURE/CONTRAST/SATURATION/…` stay explicitly refused (`UNSUPPORTED_OPERATION`), never silently approximated — creative color grading remains out of scope until a real Skill proposal earns it, per `CAPABILITY_MODEL.md`'s granularity criteria. |
| **`subtitle-skill`** | Two operations, `generate` (typed `SubtitleDocument` → SRT/WebVTT, no video I/O) and `render` (delegates burn-in to `ffmpeg-skill`'s `caption`); genuine, present security gap — cue text is validated structurally only, with no defense against later unsanitized use in an LLM prompt. | Add `capabilities[].id` (`subtitle.generate`, `subtitle.render` — `CAPABILITY_MATRIX.md` §4), `lifecycle`. This Skill's bridge has one addition beyond the generic pattern: per `SECURITY_MODEL.md`'s `untrusted_text` proposal (responding directly to this named gap), `subtitle.generate`'s `output_schema` should tag cue-text fields as untrusted. This is still purely additive to `output_schema` — no behavior change, no new validation logic, no interface break. | Registry-discoverable Provider of `subtitle.*`; downstream Agent prompt-construction can treat tagged fields as data, never instructions, without reading this Skill's source to know to do so. | N/A. `convert`, standalone `validate`, `offset`, `merge`, ASS/SSA stay not implemented. |
| **`motion-graphics-skill`** | Title cards, lower-thirds (built-in templates only), text/logo overlays (linear fade only); built entirely on `ffmpeg-skill`'s `graphics`/`overlay`/`probe`; explicitly declines MCP. | Add `capabilities[].id` (`motion_graphics.title_card`, `motion_graphics.lower_third`, `motion_graphics.overlay` — `CAPABILITY_MATRIX.md` §5), `lifecycle`, `dependencies`. Note `motion_graphics.overlay` and `video-editing-skill`'s `edit.overlay` are two distinct capability ids per `CAPABILITY_MATRIX.md`'s explicit naming note — the bridge must not collapse them. | Registry-discoverable Provider of `motion_graphics.*`; an MCP adapter becomes available "for free" from the published contract (`ARCHITECTURE.md` §5) if this Skill ever wants one, without it having to hand-build one the way `ffmpeg-skill` did. | N/A. |
| **`thumbnail-skill`** | `validate`, `render` (Pillow-based raster compositing, "never touches ffmpeg" for composition), `extract_frame` (delegates the one decode step to `ffmpeg-skill`'s `look`/`probe`); only repo with a real third-party pip dependency. | Add `capabilities[].id` (`thumbnail.render`, `thumbnail.extract_frame` — `CAPABILITY_MATRIX.md` §6), `lifecycle`. The Pillow dependency and the ffmpeg-skill dependency for `extract_frame` are declared separately in `dependencies[]` — the schema already accommodates a Skill with one Skill-dependency and one library dependency, since only the former is a `{skill_id, version_range}` entry. | Registry-discoverable Provider of `thumbnail.*`. | N/A. No AI-generated thumbnails, no best-frame selection, no face detection — stays explicitly refused by design. |
| **`qc-skill`** | `QCStatus = PASS\|WARN\|FAIL\|UNKNOWN`, worst-wins; concrete checks across video/audio/subtitle/delivery; explicit ADR-001 boundary ("not an AI agent, does not make production decisions"); content-hash `identity` scheme with cache tamper detection; talks to `ffmpeg`/`ffprobe` directly (no `ffmpeg-skill` dependency). | Add `capabilities[].id` (`measure.audio.loudness`, `measure.audio.silence`, `measure.audio.integrity`, `measure.video.freeze`, `measure.video.black_frame`, `measure.subtitle.timing`, `measure.delivery.integrity`, … — `CAPABILITY_MATRIX.md` §8a/§8b), `lifecycle`, `verification` fields already implicit in its own check structure. **No `dependencies[]` entry for `ffmpeg-skill`** — unlike the six delegating Skills, this repo (along with `media-analysis-skill` and `ffmpeg-skill` itself) has no Skill dependency to declare; its retrofit is shaped differently for exactly that reason, per `ROADMAP.md` Phase 2's own caveat, not because it is harder. `QCReport` shape, ADR-001 boundary, cache tamper-detection — unchanged. | Registers as an explicit Provider of `measure.audio.{loudness,silence,integrity}` alongside `media-analysis-skill` — converting today's silent duplication into a visible registry fact, per `CAPABILITY_MODEL.md`'s worked example (this is the direct fix `ROADMAP.md` Phase 3 executes). | N/A required. See "Optional future cleanup," below, for the one legitimate (and explicitly non-mandatory) case. |
| **`media-analysis-skill`** | `media_probe`, `stream_layout`, `video_format`, `audio_format`, `duration`, `silence`, `loudness`, `integrity`, `scene_detection` ("not semantic scenes"), `timing`; explicitly "no AI," purely observational; zero references to `qc-skill` in its own docs despite the overlap; CLI only, MCP explicitly deferred (ADR-010). | Add `capabilities[].id` (`measure.audio.loudness`, `measure.audio.silence`, `measure.audio.integrity`, `measure.video.scene_detection`, `measure.video.timing`, … — `CAPABILITY_MATRIX.md` §8a/§8c), `lifecycle`. Same no-`dependencies[]`-entry shape as `qc-skill`, for the same reason. Purely observational posture, zero decision/verdict language — unchanged. | Registers as the second explicit Provider of `measure.audio.{loudness,silence,integrity}`. `measure.video.scene_detection` and `measure.video.timing` remain sole-Provider capabilities (`qc-skill` does not implement them) — no collision to resolve there. | N/A required. See "Optional future cleanup," below. |
| **`transcription-skill`** | Local-only ASR via `faster-whisper`, isolated child process/process-group; no diarization, no cloud ASR path (ADR-002, deliberate); the *only* Skill repo with real standalone JSON Schema files (`transcript.schema.json`, `engine_spec.schema.json`, `speech_event.schema.json`) instead of an in-code generator; `run -` stdin/stdout transport self-described as "exactly what an MCP transport would also wrap." | This Skill's bridge is shaped slightly differently because its contract already lives in real schema files rather than an in-code `contract.py`: align those existing schema files' field names with `SPEC.md` §1's `input_schema`/`output_schema` shape and add the `capabilities[].id` (`transcribe.audio` — `CAPABILITY_MATRIX.md` §7), `lifecycle`, and `not_provided`/`dependencies` wrapper fields around them, additively. The `faster-whisper` engine boundary, process isolation, and ADR-002's no-cloud-ASR stance — unchanged. | Registry-discoverable Provider of `transcribe.audio`; the internal `engines/registry.py` pattern this Skill already uses one level down (multiple ASR engines within the Skill) is the exact shape `CAPABILITY_MODEL.md` §Provider cites as validating the OS-level Provider concept lifted one level up — a future cloud-ASR Provider of `transcribe.audio` could register alongside this Skill without either being redesigned. | N/A. Diarization and cloud ASR stay out of scope, per ADR-002, unless and until a real Skill proposal changes that. |

## Optional future cleanup: `qc-skill` / `media-analysis-skill` code consolidation

**This is explicitly not required by `CAPABILITY_MODEL.md`'s decision, and this document
does not schedule it.** `CAPABILITY_MODEL.md`'s decision for the confirmed
`measure.audio.{loudness,silence,integrity}` collision (`REPOSITORY_MAP.md` finding 2,
`CAPABILITY_MATRIX.md` §8a) is **"register both as Providers"** — a contract-declaration
fix requiring zero code changes to either repo's measurement logic, per
`QC_ARCHITECTURE.md` §4.2's own conclusion ("fixing the duplication does not mean
retiring one Skill... the minimum viable fix, requiring no code change, only contract
declaration"). The decision is explicitly **not** "merge the two implementations."

That said, if an interested contributor later wants to eliminate the literal code
duplication — one shared `ebur128`-parsing / `silencedetect`-parsing / decode-integrity
library that both `qc-skill`'s `measurements/audio.py` and `media-analysis-skill`'s
`analyzers/{silence,loudness,integrity}.py` wrap, each adding only their own layer on top
(`qc-skill`'s threshold/verdict judgment vs. `media-analysis-skill`'s bare observation) —
that is a **legitimate, entirely optional** future cleanup this migration strategy
flags but does not require, schedule, or design further here. It would not change either
Skill's registered Capability ids, its Provider identity, or its role distinction
(`QC_ARCHITECTURE.md` §4.2: facts vs. verdicts remain different roles even if the raw
measurement code is shared) — it is a maintenance improvement below the Capability
Contract line, not an architecture change, and nothing in this migration depends on it
happening.

## `video-production-agent`: the migration that is different in kind

Every Skill above changes its **output**, additively, and nothing else. `video-production-
agent` is not in that category, because it is not a Provider being made discoverable — it
is the orchestrator whose own internal registration mechanism is the thing eventually
being replaced. `ROADMAP.md`'s "What changes about `video-production-agent`, and what
does not" section is the authoritative statement of this; this section restates its
migration-mechanics consequences without re-deriving its phase reasoning.

### (a) Phase 1–2: zero changes, and this is load-bearing, not incidental

`ROADMAP.md` states this in its own words: *"Phase 1 and Phase 2 specifically require
**zero changes** to how `video-production-agent` currently works... Phase 1 is
schema/library work that lives outside `video-production-agent`'s repo entirely, and
Phase 2 is other Skills' contract output changing, which `video-production-agent` does
not even need to consume yet."* Concretely, this means: the
`Observation → Event → Inference/Decision → ProductionPlan → Project IR → Compiler →
Operation → Executor(ToolRouter) → Artifact → QA` pipeline, `Service.adapter()`'s manual
registration, `SkillRegistry.select_tool()`'s first-match-wins candidate list, the
`FORBIDDEN_ARG_KEYS` check, and every existing CLI command and exit code are **untouched**
through the entire span of Phase 1 and Phase 2. A Skill retrofitting its contract per the
table above does not require `video-production-agent` to read that new contract at all
until Phase 3 chooses to. This is the strongest backward-compatibility guarantee this
document can make about the orchestrator: for two full phases, nothing changes, because
nothing has to.

### (b) Phase 3–4: replace `Service.adapter()` without breaking existing CLI commands or exit codes

Starting at Phase 3, `video-production-agent`'s own code is touched for the first time —
`SkillRegistry.select_tool()`'s Provider-selection logic, replacing first-match-wins with
`CAPABILITY_MODEL.md`'s explicit collision policy (Plan-time `provider_id` → default-
provider policy → registry refusal). Phase 4 goes further, replacing `Service.adapter()`'s
hand-edited manual registration table with real registry-driven discovery: an `Operation`
names a `capability_id` (and, per Phase 3, an optional `provider_id`), and the Executor
resolves which Skill/adapter to invoke from the Phase 1–3 registry instead of a
hardcoded table entry.

The binding constraint on both phases, stated explicitly in `ROADMAP.md`: *"the existing
`FORBIDDEN_ARG_KEYS` security check, per-process-group subprocess isolation, and
`idempotency_key`/`render --resume` machinery must all continue to work unchanged — this
phase is additive to *how discovery happens*, not a rewrite of *how execution happens*."*
Restated for this document's purpose: **every existing `video-agent` CLI command
(`plan`, `render`, `render --resume`, `approve`, `reject`, `contract`, `doctor`, …) must
keep its existing argument shape and its existing exit codes throughout Phase 3 and
Phase 4.** A registry-driven Executor resolving `capability_id` → Skill/adapter is a
different *internal* lookup mechanism reaching the *same* adapter invocation shape
(`[python, <skill>/scripts/<tool>.py, <typed argv>, --json]`) that `Service.adapter()`
already produces today — from the CLI caller's perspective, nothing about how a command
is invoked or what it returns should be observably different. `ROADMAP.md` itself
flags this as the highest-integration-risk phase in the roadmap (touching a component
with 187 unit / 90 adapter tests, self-reported) for exactly this reason — not because the
registry logic is hard, but because regressing an existing, working CLI surface while
rewiring its internals is the actual risk being managed.

### (c) The Legacy Adapter: the one place a real compatibility-layer pattern is justified — and only there

**PROPOSED, and explicitly scoped to this one seam.** Nowhere else in this migration
strategy is a compatibility shim needed, because every other repo's change is purely
additive to its own contract output. `video-production-agent`'s Phase 4 migration is
different: it is swapping the *mechanism* an existing, working system uses to find a
Skill, and that swap has a real transition-window failure mode worth naming explicitly —
a Skill that has not yet completed its Phase 2 contract retrofit (see the table above)
would otherwise become **unreachable** the moment `Service.adapter()`'s manual table is
removed and nothing has replaced its entry in the registry.

The proposed answer: if the Capability registry does not yet know about a Skill —
because that Skill has not published a `CapabilityContract` yet, or its published
contract is missing a field the registry requires — the **old hardcoded
`Service.adapter()` path should keep working as a fallback** for that specific Skill,
tried only after registry lookup fails to resolve a `capability_id` to any registered
Provider. This is a real instance of the compatibility-layer pattern this document
otherwise argues is unnecessary everywhere else — justified here, and only here, because
this is the one seam where an existing, working discovery mechanism is being replaced
wholesale rather than extended additively.

**This must be temporary, and this document states a disposal condition, marked as a
judgment call rather than a hard deadline:** once all 10 Skill repos (the table above,
`ffmpeg-skill` included) publish real `CapabilityContract`s that the registry can resolve
— i.e., once Phase 2 is complete for the whole ecosystem, not partially — the Legacy
Adapter fallback path has nothing left to fall back for, and should be removed.
**PROPOSED, not a hard deadline**: this document does not commit to a calendar date or a
specific `video-production-agent` release number for the removal, because (per
`REPOSITORY_MAP.md`'s own honesty about self-reported test counts) the actual trigger
should be a verified fact — "every Skill this orchestrator knows about resolves via the
registry with zero fallback hits in the test suite" — not an assumption that Phase 2
finished on schedule. Whoever removes the Legacy Adapter should first confirm zero
fallback-path invocations occur across the existing eval suite before deleting the code,
exactly the same discipline `ROADMAP.md` Phase 3 already applies to
`SkillRegistry.select_tool()`'s rewiring.

## Retiring a compatibility layer, in general

The Legacy Adapter above is the only compatibility layer this migration strategy
proposes building — but the general policy for retiring *any* bridge in this document
(including a hypothetical future one this document does not anticipate) is stated once,
here, so it does not need re-deriving per-instance:

- **A compatibility layer is removed once 100% of its dependents have migrated off it —
  not on a calendar, not on a version number.** "Dependent" here means: every caller that
  could hit the old path in practice, not merely every caller a developer remembers.
- **Track this as a simple checklist, not a formal deprecation calendar.** For the Legacy
  Adapter specifically, the checklist is exactly the 10-row table above: one row per
  Skill, checked off when that Skill's `CapabilityContract` is confirmed
  registry-resolvable. This project has no evidence of an ecosystem at a scale that would
  justify a formal deprecation-calendar process (fixed notice periods, staged rollout
  windows, multiple concurrently-supported versions) — `VERSIONING.md` §6 already made
  this same call against Kubernetes-CRD-style multi-version serving, for the same reason
  (single-digit version numbers, 11 repos, one owner, no evidence of the operational
  shape that would justify heavier machinery), and this document extends that same
  reasoning to compatibility-layer retirement rather than inventing a different policy
  for a structurally identical problem.
- **A compatibility layer that outlives its own checklist is a standing risk, not a
  convenience.** Once every row is checked, the Legacy Adapter (or any future bridge
  built the same way) should be deleted in its own small, reviewable PR — not left in
  place "just in case," since an unremoved bridge is exactly the kind of accumulated,
  unjustified complexity `ARCHITECTURE.md` §9 lens 1 argues against everywhere else in
  this project.
