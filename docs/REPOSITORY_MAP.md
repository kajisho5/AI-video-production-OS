# Repository Map

Status: **Evidence-based, current as of 2026-09-05/06.** Every claim in this document was
verified by directly reading source code, tests, CI config, and commit history in each
repository — not inferred from README marketing copy. Where something could not be
verified it is marked `UNKNOWN`. Where the code contradicts a repo's own docs, that is
called out explicitly.

This document is the ground truth the rest of `AI-video-production-OS`'s architecture
docs are built on. If a later document disagrees with this one, this one wins unless it
is explicitly revised.

## How to read this map

Each repo entry uses four categories, applied consistently across this whole project:

- **CURRENT** — exists in code today, verified by reading it.
- **FUTURE INTENDED** — described in docs/ADRs as a direction, not implemented yet.
- **EXPERIMENTAL** — exists in code but is unstable, stubbed, or explicitly marked provisional.
- **UNKNOWN** — could not be determined from available evidence.

All 11 repositories below are single-owner (`kajisho5`), public, and — with one exception
(`video-production-agent`) — currently ship as a **single squashed commit** with no
granular history. This means "recent commits" analysis is not meaningful for 10 of the
11 repos; their `docs/decisions.md` ADR logs are the only record of how they evolved, and
those logs could not be cross-checked against real commit-by-commit history.

## The ecosystem at a glance

| Repo | Role | Version | Deps | MCP? | Delegates ffmpeg to |
|---|---|---|---|---|---|
| `video-production-agent` | Orchestrator/planner | 0.1.0 | `jsonschema>=4.17` only | No | via 9 skill adapters |
| `ffmpeg-skill` | Typed FFmpeg execution | 0.9.1 | none (stdlib) | Yes (stdio JSON-RPC) | — (is the ffmpeg boundary) |
| `video-editing-skill` | Cut/trim/concat/resize | 0.1.0 | none | No | ffmpeg-skill |
| `audio-production-skill` | Gain/mix/normalize/dynamics | 0.1.0 | none | No | ffmpeg-skill |
| `color-grading-skill` | HDR→SDR/LUT/color tag | 0.1.0 | none | No | ffmpeg-skill |
| `subtitle-skill` | SRT/VTT generation + burn-in | 0.1.0 | none | No | ffmpeg-skill (burn-in only) |
| `motion-graphics-skill` | Title cards/lower-thirds/overlays | 0.1.0 | none | No | ffmpeg-skill |
| `thumbnail-skill` | Raster thumbnail composition | 0.1.0 | Pillow≥10.0 | No | ffmpeg-skill (frame extract only) |
| `qc-skill` | Deterministic QC measurement | 0.1.0 | none | No | none (uses ffmpeg/ffprobe directly, read-only) |
| `media-analysis-skill` | Deterministic observation | 0.1.0 | none | No | none (uses ffmpeg/ffprobe directly, read-only) |
| `transcription-skill` | Local ASR (faster-whisper) | 0.2.0 | faster-whisper (optional) | No (MCP-shaped CLI) | none |

**Not in the task's original list of 9 skills, but a real, active ecosystem member:**
`transcription-skill`. It is cross-referenced by `subtitle-skill`'s README and by
`video-production-agent`'s integration CI (which clones it alongside the other 8). The
original task brief's "9 skills" framing is already stale — this is direct evidence that
**the number of Skills is not fixed and the OS must not assume it.**

## Per-repository detail

### `video-production-agent` — the orchestrator

**Role, as implemented today (CURRENT):** a CLI (`video-agent`) that runs the pipeline
`Observation → Event → Inference/Decision → ProductionPlan → Project IR → Compiler →
Operation → Executor(ToolRouter) → Artifact → QA`. All of these are real, distinctly
named types in `src/video_agent/models/__init__.py` and `agent/`, `project/`,
`execution/` — not just documentation. The IR is a single versioned JSON document
(`schemas/project.schema.json`, 1851 lines) with migration support, content-addressed
hashing (`ir_hash`, `plan_hash`), and human approve/reject workflow.

**Skill invocation (CURRENT):** every external Skill is called as **one subprocess per
call**, JSON in/out, via a per-skill adapter under `tools/<skill>/`. Discovery is
**static and manual**: `Service.adapter()` registers each adapter by hand; there is "no
package loader, plugin manager or dynamic import" (direct quote, `skills/contract.py`).
A `SkillRegistry` maps abstract production skills (e.g. `silence_cleanup`) to an ordered
list of candidate tool ids (e.g. `["ffmpeg-skill/cut", "video-editing/cut"]`) and picks
the first one whose adapter is registered and whose capability is `AVAILABLE`.

**Terminology collision (important, CURRENT):** the word "Skill" is used for two
different things in this codebase: (a) an external repository/package (`SkillPackage`,
e.g. `ffmpeg-skill`), and (b) the agent's internal notion of a production capability it
knows how to plan for (`SkillSpec`, e.g. `silence_cleanup`, which is really a capability
name). This is a real, present naming ambiguity in the source, not a hypothetical
concern — it directly motivates this project's Capability/Skill split (see
`CAPABILITY_MODEL.md`).

**AI coupling (CURRENT, notable):** `providers/base.py` defines a generic `AIProvider`
interface. The only shipped implementation is `NullProvider`. No Anthropic/OpenAI SDK is
imported anywhere; `capabilities/resolver.py` only probes for `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` environment variables to report capability status. **There is no real
AI reasoning wired into this repository today.** The "Inference"/"Decision" layer that
exists is a deterministic, rule-based engine (`policy/rules.py`, `agent/decision_engine.py`)
operating on measured Observations — not an LLM. Design principle enforced in code:
AI output (when a provider exists) is tagged `provenance="AI_GENERATED"`, is treated as
untrusted input, is validated against the system-defined structure, and never becomes an
executable Decision by itself.

**Security (CURRENT):** `FORBIDDEN_ARG_KEYS` blocks parameter keys like `command`,
`argv`, `shell`, `exec`, `filter_complex`, `api_key`, `token` recursively before they can
reach any adapter; every subprocess runs in its own process group so a timeout kills the
whole tree; `SYSTEM_CONSTRAINTS` hard-codes `execution.no_raw_shell` and
`execution.recovery.max_attempts=2`. Adversarial eval cases exist by name (e.g.
`20_path_traversal_block.json`, `11_plan_hostile_ai_no_leakage.json`).

**Provenance (CURRENT):** `Artifact` carries `hash`, `plan_id/plan_version`,
`job_id/jobs`, a `stage` lifecycle (working→candidate→approved→final→archive), and a
`provenance` dict of `ir_path, plan_hash, ir_hash, provenance_path`. Cache-hit provenance
is explicitly eval-tested.

**Explicitly NOT implemented (per code and docs — do not assume these exist):** web UI,
job queue, natural-language intent understanding backed by a real model, a
multicam/conference pipeline body (registered but `implemented=False`), any plugin
manager for adding Skills without editing source, remote APIs, cloud storage, a database.

**Development state:** the repo's own `docs/decisions.md` records 34 ADRs and a
Phase 1→3 progression, and the latest commit message claims "Unit 187, adapter 90,
pipeline 15, real-Skill integration 44/44, evals 99/99." Only one commit is visible in
this shallow clone, so that history could not be independently walked — it is taken as
self-reported, not verified commit-by-commit.

**How this repo must be treated in this architecture (per explicit task instruction):**
`video-production-agent` is **the first major consumer and orchestration layer of the
future OS, not the OS itself, and not a finished reference architecture.** It is
incomplete and under active development. The OS must not be redesigned around its
current gaps (no real AI provider, no dynamic plugin loading, no web UI), must not have
missing Agent functionality invented on its behalf, and must not discard what it has
already built correctly (the O→I→D→Plan→IR→Compile→Execute→Verify pipeline, the
forbidden-key security pattern, the provenance/artifact model) merely because the Agent
as a whole is unfinished.

### `ffmpeg-skill` — the FFmpeg execution boundary

**Role (CURRENT):** 21 typed Python-stdlib scripts (`cut`, `fit`, `caption`, `overlay`,
`graphics`, `sync`, `multicam`, `audio`, `loudness`, `silence`, `join`, `color`,
`export`, `check`, `scenes`, `look`, `render`, `probe`, `batch`, `report`, `verify`),
each a standalone `argparse` CLI. No filter string is ever accepted from a caller —
typed flags (e.g. `--compress`, `--limit`, `--gate`) are individually range-checked and
converted into filter-graph fragments internally; text/paths destined for filter graphs
are escaped, never interpolated raw.

**Discovery/contract (CURRENT, strongest infrastructure piece found in the whole
ecosystem):** `scripts/_contract.py` generates a live, machine-readable `ToolSpec` per
script directly from that script's own `argparse` parser — the schema cannot drift from
the implementation because it *is* the implementation, introspected. `docs/contract.md`
explicitly documents the intended consumption pattern by name: *"A planning agent (for
example video-production-agent's SkillRegistry) can: 1. run `ffmpeg-skill contract
--json` once and register the skill... 2. resolve `capabilities.required` against
`capabilities.available`... 3. pick a tool by role/inputs/outputs... 4. build the call
from `input_schema`... 5. run, parse `output_schema`, then run `verification.tools`."*
This is real evidence of the capability-discovery pattern this OS should formalize.

**Self-declared boundary (CURRENT):** the skill manifest has an explicit `not_provided`
field listing `["AI reasoning", "decisions", "production plans", "project IR",
"approvals", "network access", "transcription engine"]`. The skill declares its own
non-responsibilities. This is the clearest piece of evidence in the ecosystem for the
Agent/OS/Skill boundary this project formalizes.

**Interfaces (CURRENT):** direct CLI, an npm-distributed installer/CLI wrapper
(`bin/install.js`), and a stdio JSON-RPC 2.0 **MCP server** (`mcp/server.py`) — the only
skill in the ecosystem that ships an actual MCP server today. The MCP server "holds no
tool table and no schema of its own"; `tools/list` and argument mapping are derived live
from the same contract generator used by the CLI. A raw `{"argv": [...]}` escape hatch
exists but is explicitly marked `canonical: false` and still only invokes the named
script, never a shell.

**Security (CURRENT):** no `shell=True`/`os.system` anywhere; all subprocess calls are
list-argv; `mutates_input: false` for every tool (enforced/declared, source files are
never overwritten). No per-encode timeout is enforced on the main scripts (only
`verify.py` sets one) — an honest, present gap.

**Versioning (CURRENT):** two separate version axes — `skill.version` (npm/package.json,
0.9.1, changes every release) and `contract_version` ("1.0", bumps only on a breaking
`ToolSpec` shape change). This two-axis versioning is a pattern worth generalizing (see
`VERSIONING.md`).

**Provenance/caching (CURRENT, partial):** every run reports the exact ffmpeg command
line(s) executed and a probe of the output, but nothing is persisted as a sidecar/manifest
recording FFmpeg version + full parameters next to the output artifact — provenance
exists in the response, not on disk. Only `batch` has any caching (`idempotency_hint:
"cached"`); no other tool caches.

### `qc-skill` — deterministic production verification

**Role (CURRENT, matches its own claims — the one repo where the task's assumption was
fully verified against source, not just docs):** `QCStatus = PASS|WARN|FAIL|UNKNOWN`
with worst-wins aggregation, as separate dataclasses `QCMeasurement → QCFinding →
QCCheck → QCReport` (not a collapsed boolean). `overall_status` defaults to `UNKNOWN`
when no checks ran — it never silently reports PASS.

**Concrete checks implemented (CURRENT):** video (resolution/fps/codec/pixel
format/color metadata/black-frame via `blackdetect`/freeze-frame via
`freezedetect`/decode-integrity), audio (LUFS/LRA/true-peak via `ebur128`, clipping,
silence via `silencedetect`, channel layout/balance), subtitle (SRT/VTT/ASS timing only —
no semantic/wording checks), delivery (composition of the above + container/size/extension).

**Boundary enforcement (CURRENT, explicit ADR):** "qc-skill is not an AI agent and does
not make production decisions" (README, `docs/decisions.md` ADR-001). No
decision/render/publish/block logic exists in the code outside boundary-documentation
comments.

**Provenance/identity (CURRENT):** `identity = sha256(canonical_json({skill,
skill_version, kind, operation, asset_fingerprints, effective_parameters, rules,
ffmpeg_version, ffprobe_version}))`, explicitly excluding timestamps/paths/request_id —
this is the cleanest reproducibility-identity design found anywhere in the ecosystem and
is the model this OS's `PROVENANCE.md` generalizes.

**Caching (CURRENT):** real file-based cache, sharded by hash prefix, atomic write, and
**tamper detection** — a cache hit is only honored if a stored result-hash still matches
the recomputed hash of the cached report.

**Security (CURRENT):** `shell=False` always; `FORBIDDEN_KEYS` includes
`filter`/`filter_complex` in addition to the usual `command/argv/shell/exec/env`; path
policy resolves symlinks before containment checks (not string-prefix matching, which is
spoofable). Documented, honest gap: no CPU/memory/disk resource limits, only a wall-clock
timeout.

**Maturity caveat:** single-commit repo, zero third-party dependencies, no independent
test-suite execution was possible in the audit sandbox (`pytest` unavailable) — static
code review only, not a live test run.

### `media-analysis-skill` — deterministic observation

**Role (CURRENT):** `media_probe`, `stream_layout`, `video_format`, `audio_format`,
`duration` (ffprobe-only), `silence`, `loudness`, `integrity` (full decode, `-f null`,
decode-error/frame-count/timestamp checks), `scene_detection` (ffmpeg `scdet`, explicitly
"not semantic scenes" per its own README), `timing` (packet-gap/A-V sync).

**Explicitly out of scope (CURRENT, by design):** freeze-frame detection, black-frame
detection, semantic/content understanding, speaker detection, transcription, captions,
thumbnails. "No AI." Purely observational — confirmed no media-writing code path exists
anywhere in the CLI or schemas.

**Confirmed duplication with `qc-skill` (important architecture finding, CURRENT):**
silence detection, loudness measurement, and decode-integrity checking are **each
independently implemented twice** — once in `media-analysis-skill/analyzers/{silence,
loudness,integrity}.py` and once in `qc-skill/measurements/audio.py` +
`_decode_errors.py` — with no shared library between them. `qc-skill` additionally does
black/freeze-frame detection that `media-analysis-skill` does not have at all, so it is
not a strict superset/subset relationship. Awareness is one-directional: `qc-skill`'s
docs explicitly reference and position against `media-analysis-skill`; `media-analysis-skill`'s
own docs and code contain **zero** references to `qc-skill`, despite acknowledging
overlap with `ffmpeg-skill` by name ("this package is the dedicated observation domain...
which of the two a production system uses... is the agent's choice"). This is real,
present technical debt this OS's Capability model must account for — not a hypothetical
"avoid future duplication" concern.

**Interfaces (CURRENT):** CLI only. `docs/decisions.md` ADR-010 explicitly defers an MCP
server: "No MCP server in 0.1.0... can be added as a thin wrapper over `run` later."

**Security (CURRENT):** matches `qc-skill`'s pattern closely (no shell, `PATH`-only
resolution, `-protocol_whitelist file`, `-nostdin`, workspace-confined writes, output
verification rejecting secret-looking/command-like keys).

### `video-editing-skill` and `audio-production-skill` — exemplary delegation pattern

**Role (CURRENT), video-editing:** typed operations `TRIM, CUT, CONCAT (with typed
transitions), SPEED, FIT, FILL, RESIZE, OVERLAY`. Explicitly unsupported and declared as
such (not silently approximated): `CROP, FREEZE, REVERSE, IMAGE_INSERT, POSITION`.

**Role (CURRENT), audio-production:** typed operations `GAIN, TRIM, CUT,
SILENCE_REMOVE (explicit ranges only, no detection), FADE_IN, FADE_OUT, NORMALIZE (EBU
R128), MIX, MONO, STEREO, DOWNMIX, NOISE_REDUCTION, DYNAMICS (gate→compressor→limiter),
CONCAT`. Explicitly unsupported: `CHANNEL_MAP, RESAMPLE, FORMAT_CONVERT`.

**Delegation to `ffmpeg-skill` (CURRENT, verified at the source level in both repos —
this is the pattern every future Skill should copy):** each repo has exactly **one**
module that is allowed to start a subprocess (`ffmpeg_skill.py` / `adapter.py`), located
by locating an `ffmpeg-skill` checkout (env var → well-known paths), contract-version-
checked against a supported range, and invoked as
`[python, <ffmpeg-skill>/scripts/<tool>.py, <typed argv>, --json]`. Both repos have a
dedicated security test that **statically walks the AST of every module** to prove no
other `subprocess` call exists anywhere else in the codebase. Zero duplication of ffmpeg
logic was found in either repo.

**Interfaces (CURRENT):** CLI only in both; no MCP server in either.

### `color-grading-skill` and `subtitle-skill`

**`color-grading-skill` (CURRENT):** typed operations `HDR_TO_SDR` (7 tonemap curves),
`LUT_APPLY`, `RETAG` (colorspace tag only), `STRIP_DOVI`. Explicitly unsupported and
declared (raises `UNSUPPORTED_OPERATION`, never approximated):
`EXPOSURE/CONTRAST/SATURATION/TEMPERATURE/TINT/WHITE_BALANCE/GAMMA/LIFT/GAIN/LEVELS/CURVES`
— i.e. this skill honestly does not do creative color grading yet, only
technical/delivery color operations. Delegates to `ffmpeg-skill` exclusively (same
single-subprocess-module pattern as above), with a *separate* path allowlist for LUT
files vs. input media roots — a detail worth generalizing into the security model.

**`subtitle-skill` (CURRENT):** two operations — `generate` (validates a typed
`SubtitleDocument`, writes SRT/WebVTT, no video I/O at all) and `render` (delegates
burn-in to `ffmpeg-skill`'s `caption` tool, SRT only). `convert`, standalone `validate`,
`offset`, `merge`, and ASS/SSA are explicitly not implemented.

**No transcription duplication (CURRENT, resolved question):** `subtitle-skill` contains
zero ASR code and zero dependency on `transcription-skill`. It consumes a pre-built
`SubtitleDocument`/`SubtitleCue` supplied by its caller. The intended data flow, per
`subtitle-skill`'s own README diagram, is `transcription-skill → (agent-level glue) →
subtitle-skill` — i.e. deliberately mediated by the orchestrator, not a direct
library dependency between the two skills. This is a real example of correct Capability
composition: two skills that could have been coupled are kept independent, with the
Agent (or, in this OS, a typed `ProductionPlan`) as the seam.

**Security gap (CURRENT, genuine and specific — not hypothetical):** `subtitle-skill`'s
validation is structural only (rejects control characters, enforces line-length/duration/
reading-speed constraints) and does **not** address the case where subtitle cue text is
later fed into an LLM prompt by a downstream agent step (e.g. "summarize/translate these
captions"). No sanitization against instruction-like text in cue content exists. This is
a concrete instance of the "prompt injection via subtitle/metadata" risk the task asks
about — it is present today, not speculative.

### `motion-graphics-skill` and `thumbnail-skill`

**`motion-graphics-skill` (CURRENT):** title cards, lower-thirds (built-in
fade/slide templates only), free-form text overlays, image/logo overlays with linear
fade only (no scale/slide animation). Built entirely on `ffmpeg-skill`'s `graphics`/
`overlay`/`probe` tools — not Remotion, not Lottie, not After Effects. `docs/architecture.md`
explicitly lists "MCP" among things it deliberately does not do.

**`thumbnail-skill` (CURRENT):** `validate`, `render` (Pillow-based raster compositing —
"never touches ffmpeg" for the composition step itself), `extract_frame` (delegates to
`ffmpeg-skill`'s `look`/`probe` for the one video-decoding step it needs). No AI-generated
thumbnails, no "best-frame" selection, no face detection — explicitly refused by design.
The only repo in the ecosystem with a real third-party pip dependency (`Pillow>=10.0`).

### `transcription-skill` — real but undocumented-in-the-task ecosystem member

**Role (CURRENT):** local-only ASR via `faster-whisper` (CTranslate2 Whisper), run in an
isolated child process/process-group so a timeout can hard-kill it. No diarization
(`speaker_id` always null). No cloud ASR path exists or is stubbed — `docs/decisions.md`
ADR-002 explicitly states this was a deliberate choice, not an oversight. Outputs:
structured `Transcript` (segments, optional word timestamps), `SpeechEvent` records,
SRT/VTT export.

**Notable (CURRENT):** the only skill repo with real standalone JSON Schema files
(`schemas/transcript.schema.json`, `engine_spec.schema.json`, `speech_event.schema.json`)
rather than an in-code contract generator. Its `run -` stdin/stdout transport is
described in its own ADR-021 as "exactly what an MCP transport would also wrap" —
MCP-shaped, but not an actual MCP server.

## Cross-cutting findings that shape this OS's architecture

1. **The delegate-to-ffmpeg-skill pattern is real, consistent, and independently
   enforced** (via AST-walking security tests) across `video-editing-skill`,
   `audio-production-skill`, `color-grading-skill`, `motion-graphics-skill`, and
   `thumbnail-skill`. This is the strongest evidence in the whole ecosystem that a
   shared, low-level execution primitive (ffmpeg-skill) with higher-level typed skills
   built on top of it is a validated pattern, not a hypothesis. `CAPABILITY_MODEL.md`
   and `EXECUTION_MODEL.md` build on this directly.

2. **Real, unaddressed duplication exists between `qc-skill` and `media-analysis-skill`**
   for silence/loudness/integrity measurement. This is not hypothetical "avoid future
   duplication" — it already happened once. The Capability model must have an answer for
   "two Skills independently implement the same Capability" that is better than silent
   duplication (see `CAPABILITY_MODEL.md` §Capability Collision).

3. **Every skill repo independently reinvented the same security primitives**: a
   `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` denylist, a `PathPolicy` with symlink-resolved
   containment, `shell=False` everywhere, workspace-confined output, no-clobber-of-input.
   This convergent design is strong evidence these primitives belong in a shared OS-level
   contract/library rather than being re-derived by every future Skill author (see
   `SECURITY_MODEL.md`).

4. **Contract/discovery mechanisms are inconsistent across the ecosystem**: `ffmpeg-skill`
   and `video-production-agent`'s adapters have the richest machine-readable contracts
   (introspected from `argparse` / pinned JSON files with drift detection);
   `transcription-skill` uses real standalone JSON Schema files; most others have an
   in-code `contract.py` with no schema file at all. There is no single, ecosystem-wide
   contract format today. `CAPABILITY_MODEL.md` and `SKILL_SPEC.md` propose one.

5. **MCP is used by exactly one repo** (`ffmpeg-skill`) and is explicitly deferred or
   explicitly rejected as a goal by at least three others
   (`media-analysis-skill` ADR-010, `motion-graphics-skill` architecture doc,
   `subtitle-skill` README). MCP cannot be assumed as the ecosystem's interface layer —
   see `ARCHITECTURE.md` §MCP.

6. **No repository in the ecosystem has more than one real commit** except
   `video-production-agent`. All are effectively fresh scaffolds as of this audit. Read
   every "battle-tested" or "mature" characterization in this document as "well-specified
   initial implementation," not "years of production hardening."

## Explicit UNKNOWNs

- Whether `video-production-agent`'s self-reported test counts (187 unit / 90 adapter /
  99 evals, etc.) actually pass in a clean environment — not independently re-run here.
- Whether any of these repos have open PRs, issues, or branches beyond `main` — the
  audit worked from shallow clones of `main` only; GitHub-side PR/issue state was not
  queried.
- Whether `qc-skill`'s and `media-analysis-skill`'s test suites pass — `pytest` was not
  available in the audit sandbox; verification was static/code-reading only.
- The real commit-by-commit history behind every repo's single squashed commit (all
  claim PR numbers and ADR sequences in their docs that are not reconstructable from the
  git history actually present in these clones).
