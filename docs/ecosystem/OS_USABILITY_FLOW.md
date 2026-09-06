# OS usability flow — Install → Discover → Route → Execute → Verify → Result

**Status: CURRENT**, written 2026-09-06 under a strategic-pivot directive from the user: stop
treating architecture/dashboard/registry/System-Intelligence work as the goal, and instead
measure everything by one question — *if a user installs this OS today, how far can they
actually get toward producing video?* This file is the running answer to that question,
grounded in real command runs in a real sandbox (working `ffmpeg`/`ffprobe`, all 10 Skill
repos cloned as local checkouts, `video-production-agent` installed via `pip install -e .`),
not static reading. Update it whenever the answer changes; don't let it go stale like a
one-time report.

## The target flow, rated from real evidence

| # | Step | Status | Evidence |
|---|------|--------|----------|
| 1 | Clone/install the OS | **PARTIAL** | No single bootstrap script for the ecosystem (11 repos: this one + `video-production-agent` + 10 Skills). Each repo has its own `pip install -e .`; some Skills run un-installed from a checkout via `VIDEO_AGENT_*_DIR` env vars instead. A fresh user gets no single command — see P0 gap below. |
| 2 | Confirm dependent runtime (ffmpeg, Python deps, optional ASR engine) | **IMPLEMENTED** | `video-agent doctor` really probes `ffmpeg`/`ffprobe`/encoders/decoders/filters/fonts/GPU and every registered Skill's own doctor. Ran for real in a fresh Ubuntu sandbox: found ffmpeg/ffprobe missing, installed them (`apt-get install -y --fix-missing ffmpeg fonts-dejavu-core`), doctor then reported them `AVAILABLE`. This step **works and is honest** — it doesn't lie about what's missing. |
| 3 | Discover Skills | **IMPLEMENTED** | `locate_*()` per Skill (checkout dir via env var, `~/.claude/skills/<name>`, `./vendor/<name>`, `../<name>`, or a console script on `PATH`) really finds installed/checked-out Skills; confirmed for all 10. |
| 4 | Fetch each Skill's Capability Contract | **IMPLEMENTED** | Each adapter really calls the Skill's own `contract`/`skill --json` and gets a real document back (not mocked). Confirmed for qc-skill, color-grading-skill, subtitle-skill and others by direct invocation. |
| 5 | OS/Agent recognizes the Capability | **IMPLEMENTED — all 3 real bugs found this session are now fixed and merged** | `capabilities/resolver.py`'s `_finishing_skill()` combines the Skill's own doctor status with a hard version-compatibility gate (`check_contract()`) and a soft drift check (`contract_drift()` against a pinned snapshot) — **either one failing marks the whole Skill `MISSING`, regardless of whether the Skill itself is healthy.** Found and fixed this session: (a) `qc-skill`'s pinned contract snapshot was stale (missing an already-merged, purely additive `delivery_package` kind/7 checks/several findings) — fixed via `video-production-agent` PR #28 (**merged**). (b) `motion-graphics-skill`'s pinned contract snapshot was stale in exactly the same way (missing 4 already-merged element types: `bug`/`chapter`/`countdown`/`progress`) — fixed via PR #29 (**merged**), found by systematically re-checking every Skill after the qc fix. (c) `color-grading-skill`'s hard version gate (`SUPPORTED_SKILL_VERSIONS = ("0.1.",)`) rejected the real, released 0.2.0 skill — found independently in this session, then discovered `video-production-agent` PR #26 (already merged) fixes this properly. All 10 Skills verified `AVAILABLE` together in a real `video-agent doctor` run once all three fixes are in place. |
| 6 | Agent recognizes which Capabilities it can route to which tool | **IMPLEMENTED** | `SkillRegistry.select_tool()` / `resolve_tools()` is real, tested, and does not depend on this project's own `registry/` package at all — the Agent solved Skill→Tool selection with its own mechanism (see `DECISION_LOG.md` D8). Verified again this session via `video-agent skills`. |
| 7 | User issues a natural-language request | **PARTIAL, one real bug found and fixed this session** | `video-agent plan --request "<text>"` exists and is real, and still only recognizes a narrow, deliberately-scoped set of unambiguous phrases (`agent/requirements.py`'s own docstring: "Phase 1 has no LLM"). The specific bug this session found — "normalize loudness to -16 LUFS" producing an empty plan ("nothing to do") because the numeric target was silently dropped while only the boolean `audio.normalize` intent was captured — is fixed via `video-production-agent` PR #30 (Draft): a second, equally narrow extraction pass now captures an explicit `<number> LUFS`/`<number> dBTP` target from the text. Verified with a real before/after run of the exact same `--request` string. The underlying scope limitation (only a handful of hand-written phrase patterns, no general free-text intent recognition) remains real and is the honest next gap here — see WORK_QUEUE.md if/when broader natural-language support becomes the priority. |
| 8 | Agent selects the Capability needed | **IMPLEMENTED** (once the request is expressed as a decision, whether via `--set` or a recognized phrase) | Confirmed via a real run: a `--set audio.loudness.target_lufs=-16` plan produced a real `DRAFT`→`APPROVED` decision (`audio.loudness`) with real evidence and a concrete step. |
| 9 | Execute the Skill/Tool | **IMPLEMENTED** | `video-agent render` on the plan above ran a real `ffmpeg-skill/loudness` invocation against a real generated test video (`ffmpeg lavfi` source, 5s, 640×360) and produced a real output file. Not simulated, not mocked. |
| 10 | Process real media | **IMPLEMENTED** | Same run: real bytes in, real bytes out, real `sha256`/provenance recorded (`jobs/<id>/provenance.json`). |
| 11 | Verify/QC the output | **IMPLEMENTED** | Same run: `render` auto-invoked QA, produced a real QC sheet PNG and a real report (`report.md`/`report.json`) — `QA PASS: 5 pass, 0 incident(s)`. |
| 12 | Return the result to the user | **IMPLEMENTED** | `report.md` is a real, human-readable summary with the plan, decisions (with evidence and confidence), and QA outcome; `deliver` exists to promote the QA-passed artifact. |

**Bottom line**: with the qc (PR #28, **merged**), motion-graphics (PR #29, **merged**) and
color-grading (PR #26, **merged**) fixes all in place, **all 10 Skills report `AVAILABLE`**
in a real `video-agent doctor` run (transcription needed
`pip install "transcription-skill[faster-whisper]"` — a real, one-line, documented optional
extra, not a bug), and a full, real Plan→Validate→Render→QA cycle **actually works end to
end today** for at least the ffmpeg-skill-only path (loudness normalization tested; the
architecture is the same for every other Skill/tool pair). Step 7 (natural-language request
parsing) had a real bug of its own — an explicit numeric target named in the request text
(e.g. "-16 LUFS") was silently dropped — fixed via PR #30 (Draft). The underlying scope
limitation remains real: this is still a small hand-written phrase list, not general
free-text understanding, so "ユーザーが自然言語で動画制作を依頼する" is more true than it was but
still only partially true — most real control still goes through `--set key=value`.

## Gaps, by priority (per the pivot's own P0–P3 scheme)

### P0 — install/bootstrap/runtime/execution
- **No single bootstrap/install command for the ecosystem.** A fresh user must clone 11
  repositories separately, `pip install -e .` several of them, and wire 9 `VIDEO_AGENT_*_DIR`
  environment variables by hand (or install each Skill's console script). Nothing in this
  repository or `video-production-agent` automates that. This is the single largest gap
  between "the architecture exists" and "a user can install this and use it today."
- Runtime dependency confirmation (ffmpeg/ffprobe/encoders/ASR) is otherwise solid
  (`video-agent doctor` — see step 2 above).

### P1 — Skill discovery / Capability registration / Agent routing / execution / verification
- **Fixed this session, merged**: qc-skill pinned-contract drift (PR #28) and
  motion-graphics-skill pinned-contract drift (PR #29), both in this repo's sibling
  `video-production-agent`. color-grading-skill version gate (already fixed upstream, PR #26,
  merged) — confirmed, no action needed. Systematically re-checked all remaining Skills
  (ffmpeg-skill, media-analysis, transcription, video-editing, audio-production, subtitle,
  thumbnail) for the same pattern after re-syncing every local checkout to its real
  `origin/main` — no further instances found. All 10 Skills confirmed `AVAILABLE` together.
- **Fixed this session, PR #30 (Draft)**: the specific LUFS-target-dropped bug in step 7's
  free-text parsing (see step 7 above).
- **Real, open**: natural-language request parsing (step 7 above) is still a small hand-written
  phrase list by design (`agent/requirements.py`'s own docstring: "Phase 1 has no LLM"), not
  general free-text understanding. This remains the gap most directly limiting
  "ユーザーが自然言語で動画制作を依頼する" — the LUFS fix closes one concrete bug in it, not the
  underlying scope limitation.
- Deliberately not touched: subtitle-skill's tool-id naming issue (`DECISION_LOG.md` D9) — a
  real but wide-blast-radius rename, not a silent-`MISSING` bug like the three above.

### P2 — System Intelligence → OS runtime connection
- Not evaluated this session (correctly out of scope per the pivot: "System Intelligence自身を
  完成させることが、OS完成より優先されてはいけない"). `system-intelligence` remains a separate,
  pre-alpha project with no real integration into this ecosystem (see `HANDOFF.md`).

### P3 — Dashboard / research / external registry / federation
- Deliberately not touched this session, per the pivot's own instruction not to keep expanding
  these.

## What changed this session (2026-09-06, post-pivot)

- `video-production-agent` PR #28 (Draft): qc-skill pinned-contract refresh, fixing a real
  false-`MISSING` bug found via a real `video-agent doctor` run.
- Confirmed `video-production-agent` PR #26 (already merged) independently fixes the
  color-grading-skill version-gate bug this session also found — no duplicate work done.
- Installed `transcription-skill[faster-whisper]` in the sandbox, confirming transcription's
  `MISSING` status was a genuine, documented, optional-dependency gap, not a bug — after
  installing it, `video-agent doctor` reports `transcription: AVAILABLE`.
- Ran a real, non-simulated Plan→Validate→Render→QA cycle against a freshly generated test
  video, proving the full execution/verification pipeline is real, not just claimed.
- `video-production-agent` PR #29 (Draft): found and fixed the identical stale-pinned-contract
  bug in `motion-graphics-skill`'s adapter (4 new element types — `bug`/`chapter`/`countdown`/
  `progress` — closing that Skill's own already-merged feature arc), the same class of bug as
  the qc-skill fix. Systematically re-checked the remaining 7 Skills (ffmpeg-skill,
  media-analysis, transcription, video-editing, audio-production, subtitle, thumbnail) for the
  same pattern after re-syncing every local checkout to its real `origin/main` (several had
  drifted onto stale merged feature branches) — found no further instances.
- Verified all three fixes together (a local, unpushed merge of `main` + PR #28 + PR #29) make
  **all 10 Skills report `AVAILABLE`** in a real `video-agent doctor` run — the ecosystem's
  first fully-green real-environment doctor result this session found.
- Lesson for future sessions in this sandbox: testing `scripts/bootstrap.sh` against a scratch
  clone directory left several Skills' `pip install -e .` pointing at that scratch directory
  instead of `/home/user/<skill>` (Python's editable-install meta-path finder wins over
  `PYTHONPATH`/env-var-based checkout discovery, so this silently fed stale contract data into
  otherwise-correct adapter code and briefly looked like a real regression). Fixed by
  reinstalling every Skill editable from its real `/home/user/<skill>` checkout; if `video-agent
  doctor` ever again disagrees with a Skill's own CLI run of `skill --json`, check
  `python3 -c "import <pkg>; print(<pkg>.__file__)"` for exactly this before assuming a code bug.
- PR #28, #29 and #26 all merged; all 10 Skills confirmed `AVAILABLE` on real `main`, not just
  in a local test merge.
- `video-production-agent` PR #30 (Draft): fixed the LUFS-target-dropped bug in step 7's
  free-text parsing — found via the exact real `--request "normalize loudness to -16 LUFS"`
  run this document's step 7 row describes, confirmed fixed with the same command afterward.
