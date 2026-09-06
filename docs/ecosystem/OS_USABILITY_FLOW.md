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
| 1 | Clone/install the OS | **IMPLEMENTED** | `scripts/bootstrap.sh` (this repo) really clones `video-production-agent` + all 10 Skill repos as siblings, `pip install -e .`s the Python ones, checks ffmpeg/ffprobe, and runs a real `video-agent doctor` — one command, no env vars needed (sibling-directory discovery). Verified for real in a genuinely fresh scratch directory: all 10 Skills report `AVAILABLE`. Was previously not linked from this README's own Quick Start (a user reading the README top-to-bottom would never find it) — fixed, see the P0 section below. |
| 2 | Confirm dependent runtime (ffmpeg, Python deps, optional ASR engine) | **IMPLEMENTED** | `video-agent doctor` really probes `ffmpeg`/`ffprobe`/encoders/decoders/filters/fonts/GPU and every registered Skill's own doctor. Ran for real in a fresh Ubuntu sandbox: found ffmpeg/ffprobe missing, installed them (`apt-get install -y --fix-missing ffmpeg fonts-dejavu-core`), doctor then reported them `AVAILABLE`. This step **works and is honest** — it doesn't lie about what's missing. |
| 3 | Discover Skills | **IMPLEMENTED** | `locate_*()` per Skill (checkout dir via env var, `~/.claude/skills/<name>`, `./vendor/<name>`, `../<name>`, or a console script on `PATH`) really finds installed/checked-out Skills; confirmed for all 10. |
| 4 | Fetch each Skill's Capability Contract | **IMPLEMENTED** | Each adapter really calls the Skill's own `contract`/`skill --json` and gets a real document back (not mocked). Confirmed for qc-skill, color-grading-skill, subtitle-skill and others by direct invocation. |
| 5 | OS/Agent recognizes the Capability | **IMPLEMENTED — all 3 real bugs found this session are now fixed and merged** | `capabilities/resolver.py`'s `_finishing_skill()` combines the Skill's own doctor status with a hard version-compatibility gate (`check_contract()`) and a soft drift check (`contract_drift()` against a pinned snapshot) — **either one failing marks the whole Skill `MISSING`, regardless of whether the Skill itself is healthy.** Found and fixed this session: (a) `qc-skill`'s pinned contract snapshot was stale (missing an already-merged, purely additive `delivery_package` kind/7 checks/several findings) — fixed via `video-production-agent` PR #28 (**merged**). (b) `motion-graphics-skill`'s pinned contract snapshot was stale in exactly the same way (missing 4 already-merged element types: `bug`/`chapter`/`countdown`/`progress`) — fixed via PR #29 (**merged**), found by systematically re-checking every Skill after the qc fix. (c) `color-grading-skill`'s hard version gate (`SUPPORTED_SKILL_VERSIONS = ("0.1.",)`) rejected the real, released 0.2.0 skill — found independently in this session, then discovered `video-production-agent` PR #26 (already merged) fixes this properly. All 10 Skills verified `AVAILABLE` together in a real `video-agent doctor` run once all three fixes are in place. |
| 6 | Agent recognizes which Capabilities it can route to which tool | **IMPLEMENTED** | `SkillRegistry.select_tool()` / `resolve_tools()` is real, tested, and does not depend on this project's own `registry/` package at all — the Agent solved Skill→Tool selection with its own mechanism (see `DECISION_LOG.md` D8). Verified again this session via `video-agent skills`. |
| 7 | User issues a natural-language request | **PARTIAL, one real bug found and fixed this session** | `video-agent plan --request "<text>"` exists and is real, and still only recognizes a narrow, deliberately-scoped set of unambiguous phrases (`agent/requirements.py`'s own docstring: "Phase 1 has no LLM"). The specific bug this session found — "normalize loudness to -16 LUFS" producing an empty plan ("nothing to do") because the numeric target was silently dropped while only the boolean `audio.normalize` intent was captured — is fixed via `video-production-agent` PR #30 (**merged**): a second, equally narrow extraction pass now captures an explicit `<number> LUFS`/`<number> dBTP` target from the text. Verified with a real before/after run of the exact same `--request` string. The underlying scope limitation (only a handful of hand-written phrase patterns, no general free-text intent recognition) remains real and is the honest next gap here — see WORK_QUEUE.md if/when broader natural-language support becomes the priority. |
| 8 | Agent selects the Capability needed | **IMPLEMENTED** (once the request is expressed as a decision, whether via `--set` or a recognized phrase) | Confirmed via a real run: a `--set audio.loudness.target_lufs=-16` plan produced a real `DRAFT`→`APPROVED` decision (`audio.loudness`) with real evidence and a concrete step. |
| 9 | Execute the Skill/Tool | **IMPLEMENTED, verified for six independent Skill/tool pairs — plus one crash found and fixed** | `video-agent render` on the plan above ran a real `ffmpeg-skill/loudness` invocation against a real generated test video (`ffmpeg lavfi` source, 5s, 640×360) and produced a real output file. Not simulated, not mocked. Separately re-verified with `--set color.target=bt709` against `color-grading-skill` (one of the three Skills fixed this session) end to end: real `color-grading/run` invocation, `Job ... COMPLETED`, `QA PASS: 5 pass, 0 incident(s)` — confirming the pinned-contract fix didn't just make the Skill report `AVAILABLE`, it made it genuinely executable. Trying to verify qc-skill the same way (real execution, not just a healthy `doctor`) surfaced a real crash: **any** plan with zero edit steps — the plain "nothing to change, just deliver" case, and the qc-only case — made `render` exit with a raw `error: 'pending'` instead of completing. Root-caused to `plan_status()` returning `DRAFT` forever whenever `plan.steps` was empty, even with every decision already resolved; fixed via `video-production-agent` PR #31 (**merged**). Re-verified with the exact real repro commands afterward: both the bare "nothing to do" plan and the `--set qc=true` plan now `render` to `COMPLETED`. Since then, also confirmed for real: `thumbnail-skill` (a genuine PNG frame), `audio-production-skill`'s `audio.extract` path (a real gain op, `.wav` output), and `subtitle-skill` both generating (real `faster-whisper` transcript from an `espeak-ng`-synthesized speech clip, not fabricated — cues match the source script) and burning captions into the picture (visually confirmed on an extracted frame). Also found and fixed a second real crash affecting real, untrimmed footage specifically: a `round(dur, 3)` vs. `TIME_EPS` mismatch made `plan`/`render` fail with a spurious "exceeds asset duration" error on roughly half of all real-world durations (`video-production-agent` PR #37, **merged**). See "What changed this session" below for each. |
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
(e.g. "-16 LUFS") was silently dropped — fixed via PR #30 (**merged**). The underlying scope
limitation remains real: this is still a small hand-written phrase list, not general
free-text understanding, so "ユーザーが自然言語で動画制作を依頼する" is more true than it was but
still only partially true — most real control still goes through `--set key=value`. Trying to
push qc-skill's fix (step 5) through a *real* render (not just `doctor`) also caught a
render-time crash on the single most common plan shape — "nothing to change, just deliver" —
fixed via PR #31 (**merged**): see step 9. Since then, real end-to-end execution has been
confirmed for 8 Skill/tool pairs (ffmpeg-skill/loudness, color-grading, qc, motion-graphics,
thumbnail, audio-production, subtitle [generate + burn-in], video-editing/concat), and the
single most common no-preset "deliver as-is" request path — previously silently producing no
Artifact and skipping QC — is now fully fixed end to end (PRs #32-#35, `ffmpeg-skill` PR #27,
`video-production-agent` PR #36, all **merged**): see step 9 and `WORK_QUEUE.md` item 9.

## Gaps, by priority (per the pivot's own P0–P3 scheme)

### P0 — install/bootstrap/runtime/execution
- **RESOLVED 2026-09-06**: this section used to describe "no single bootstrap/install
  command for the ecosystem" as the single largest open gap — that description was stale.
  `scripts/bootstrap.sh` already existed in this repository (added together with the first
  version of this document, commit `ca2639e`) and genuinely does the whole job: clones
  `video-production-agent` + all 10 Skill repos as siblings, `pip install -e .`s the Python
  ones, checks `ffmpeg`/`ffprobe`, and finishes with a real `video-agent doctor` run — no
  `VIDEO_AGENT_*_DIR` environment variables needed at all (sibling-directory discovery
  handles it). Re-verified for real just now in a genuinely fresh scratch directory: **all 10
  Skills report `AVAILABLE`**. The actual remaining gap was narrower than this section's own
  wording claimed: the script was never referenced from the README's own "Quick start"
  section, which instead told a fresh reader "there is no installable application" and walked
  through the individual per-repo path only — so a user reading the README top-to-bottom
  would never discover the one-command path already existed. Fixed by updating
  `README.md`'s Quick Start to lead with `./scripts/bootstrap.sh` as the recommended path to
  the full working ecosystem, while keeping the honest single-Skill (`npm install -g
  ffmpeg-skill`) path for anyone who only wants one piece.
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
- **Fixed this session, merged**: the specific LUFS-target-dropped bug in step 7's
  free-text parsing (PR #30, see step 7 above), and a render-time crash on any zero-edit-step
  plan (PR #31, see step 9 above) — found by pushing verification past `doctor`/`plan` into a
  real `render` run.
- **Real, open**: natural-language request parsing (step 7 above) is still a small hand-written
  phrase list by design (`agent/requirements.py`'s own docstring: "Phase 1 has no LLM"), not
  general free-text understanding. This remains the gap most directly limiting
  "ユーザーが自然言語で動画制作を依頼する" — the LUFS fix closes one concrete bug in it, not the
  underlying scope limitation.
- **Fully fixed this session (PRs #32, #33, #34, #35, and finally `ffmpeg-skill` PR #27 +
  `video-production-agent` PR #36 — see WORK_QUEUE.md item 9 for the full history)**: for a
  generic-profile, no-preset delivery, the render's own
  `report.md`/`report.json` was showing `"artifacts": []` even on `COMPLETED` — nothing was
  ever delivered, and `--set qc=true` never ran a QC check either. Split into two cases while
  investigating: (1) **something real was processed** (a motion-graphics overlay, or the
  always-on technical silence trim) — `compiler.py`'s `delivery()` already resolved a real,
  in-workspace, QA-verified path for it; only `service.py`'s `_register_artifacts()`'s
  `not t.get("preset")` guard was silently dropping it. Fixed (PR #32) and its own provenance
  (which operation/decisions actually produced it) fixed right after (PR #33) — this deliverable
  is now correctly registered as a `MASTER` Artifact with a real, complete audit trail.
  (2) **`--set qc=true` never ran a check at all**, for either case — traced one layer deeper
  than PR #32 reached: `agent/planner.py`'s `qc_steps()` only ever plans a qc step alongside a
  `delivery_export` step (preset-only), so there was never a tool selection for the compiler to
  find for a no-preset target. Fixed (PR #34): the planner now plans a qc step gating the
  subject's own current media directly, the compiler compiles it, and the QA layer looks it up
  correctly — verified for real that both an untouched and a processed no-preset request now get
  a genuine qc-skill check (admitted, real verdict, surfaced in the QA summary; a processed
  artifact now correctly promotes to `approved` instead of the false FAIL that PR #32 left as an
  honest but incomplete stand-in). **Now also fully closed**: registering an Artifact for a
  genuinely untouched deliverable (case 1 when literally nothing processed the subject) needed
  an actual stream-copy/remux operation materializing the passthrough deliverable inside the
  workspace, which didn't exist in `ffmpeg-skill` — the real cross-repo work this item had been
  waiting on. `ffmpeg-skill` gained `export.py --preset copy` (PR #27, merged: a genuine stream
  copy, no re-encode, source codecs/container/colour tags unchanged), and
  `video-production-agent` PR #36 (merged) routes exactly this case through it —
  `compiler.py`'s `delivery()` now materializes a genuinely untouched, video-capable subject
  into the job's `artifacts/` directory via a real `delivery_export` op, with `planner.py`
  planning the matching step so the compiler has a tool selection (same ADR-021 shape as the
  PR #34 QC fix). Verified for real: `IntegratedPipelineRealTests` Scenario 11 now gets a real
  stream-copy export, a real registered `MASTER`/`source`/`PASS` Artifact credited to
  `ffmpeg-skill/export`, and a real QC gate against the delivered bytes — against real
  ffmpeg-skill, motion-graphics-skill and qc-skill. `tests/test_integration.py`: 45 passed, 0
  skipped. A genuinely untouched *pure-audio* subject on the audio-production path is
  deliberately excluded (the copy preset needs a video stream) and is not otherwise known to be
  reachable today; a future item if it turns out to be. Tracked as `WORK_QUEUE.md` item 9,
  now fully resolved.
- Deliberately not touched: subtitle-skill's tool-id naming issue (`DECISION_LOG.md` D9) — a
  real but wide-blast-radius rename, not a silent-`MISSING` bug like the three above.
- **Fixed this session, merged**: a `round(dur, 3)` vs. `TIME_EPS` rounding mismatch made
  `plan`/`render` spuriously fail with "exceeds asset duration" on any real, untrimmed asset
  whose duration's 4th decimal digit is `>= 5` — roughly half of all real-world durations,
  not a synthetic-media edge case (`video-production-agent` PR #37, see step 9 above and
  `WORK_QUEUE.md` item 10 for the full root cause).

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
- `video-production-agent` PR #30 (**merged**): fixed the LUFS-target-dropped bug in step 7's
  free-text parsing — found via the exact real `--request "normalize loudness to -16 LUFS"`
  run this document's step 7 row describes, confirmed fixed with the same command afterward.
- `video-production-agent` PR #31 (**merged**): tried to verify qc-skill's PR #28 fix with a
  real `render`, not just `doctor`. Both the plain "nothing to change" plan and the
  `--set qc=true` plan crashed identically with `error: 'pending'`. Root-caused through
  `plan_status()` (returned `DRAFT` forever for any zero-step plan, even fully-resolved ones)
  → `service.render()` (its `WAITING_FOR_APPROVAL` result for that case has no `"pending"` key)
  → `cli.py`'s `cmd_render()` (indexes `out["pending"]` unconditionally). Fixed `plan_status()`
  to only return `DRAFT` when there are neither steps nor decisions, and hardened
  `cmd_render()`'s dict access defensively. Caught and fixed one test (`test_case5_...`) whose
  assertion had only been passing because of this same bug (traced with a standalone repro
  before changing it — see the PR body). Re-ran the real repro commands after the fix: both
  cases now `render` to `COMPLETED`. Full suite: 307 passed, same 4 pre-existing environmental
  failures, 0 new regressions. While verifying this, noticed the QC gate itself silently never
  compiles an op for a no-preset delivery.
- Investigated that finding fully (no PR — nothing shipped, on purpose). Confirmed via a real
  render's `report.json` (`"artifacts": []` on a `COMPLETED` no-preset job) that it's actually
  two compounding gaps, not one: no Artifact is ever registered for a no-preset delivery either,
  so "deliver as-is" completes having delivered nothing at all. Traced both to the same
  `not t.get("preset")` guard pattern repeated in `compiler.py`'s `delivery()`/`qc_gate()` and
  `service.py`'s `_register_artifacts()`. Tried the direct fix (point the deliverable at the
  subject's current media, drop the guards); it made a real render of the plain "nothing to
  change" case fail with `ARTIFACT_OUTSIDE_WORKSPACE` — the artifact store's own security
  boundary (ADR-022) correctly refuses to register a path outside `<workspace>`, which is
  exactly where an untouched source asset lives. Confirmed the revert is clean
  (`git diff origin/main` empty) before moving on. This needs an actual stream-copy/remux
  operation that writes the passthrough deliverable into the workspace — `ffmpeg-skill`'s own
  `export.py` has no such preset today — so it's real, cross-repo work for a future session, not
  a same-file patch.
- Split that finding in two and fixed the safely-fixable half. `video-production-agent` PR #32
  (**merged**): the "two compounding gaps" framing above was one gap too coarse — a no-preset
  delivery that something *actually processed* (motion-graphics text overlay tested for real,
  and the always-on technical silence trim) already has a real, in-workspace, QA-verified path
  from `compiler.py`'s own `delivery()`; only `_register_artifacts()`'s guard was dropping it.
  Fixed that one function (kept `qc_gate()`'s guard untouched after confirming dropping it too
  would crash — `planner.py`'s `qc_steps()` never plans a qc step for a no-preset target, so
  `_step_tools()` has no tool selection for the compiler to find). Verified for real: this case
  now registers a proper `MASTER` Artifact, and `--set qc=true` on it correctly comes back QA
  `FAIL`/`NOT_READY` with an honest `fix_hint` (ADR-032's existing fail-closed check already
  handles it) rather than crashing or silently passing. New regression test added. Full suite:
  308 passed, same 4 pre-existing environmental failures, 0 new regressions. The genuinely
  unprocessed "nothing to do" case is unaffected and remains WORK_QUEUE.md item 9 — updated that
  item to record what's now fixed vs. what's still open.
- Extended real end-to-end verification (genuine `plan`→`render`, not just `doctor`) to two more
  Skill/tool pairs this round: `thumbnail-skill` (`--set thumbnail=true` → real
  `thumbnail/extract_frame` call, a genuine 1280×720 PNG written and QA `PASS`, artifact
  `stage: candidate`/`delivery_status: READY`) and `audio-production-skill`'s `audio.extract`
  path (`--set audio.production=true --set audio.gain=-3 --set audio.extract=true` on the same
  video → a real `audio-production/run` gain op, `.wav` output, `COMPLETED`, and — since this is
  exactly the "processed, no preset" shape PR #32 just fixed — a correctly registered `MASTER`
  artifact). `subtitle-skill` was attempted (`--set subtitle=true --kind transcript --offline`)
  but correctly `BLOCK`ed: the test clip is a synthetic tone with no speech, so an empty
  transcript is the right outcome (`transcription-skill` itself reports `AVAILABLE`) — not a
  bug, just an unsuitable test asset; needs a real speech clip to verify further.
- Re-diagnosed the "4 pre-existing environmental failures" precisely instead of continuing to
  wave at them as "known, environmental" — 2 turned out to be genuinely cwd-dependent and now
  pass cleanly when the suite is run from inside the `video-production-agent` checkout instead
  of `/tmp` (`VideoEditingRealTests`'s two tests call `locate_ffmpeg_skill()` with no explicit
  dir, which needs to run from inside the checkout for its own sibling-discovery to find
  `../ffmpeg-skill`). The other 2 (`MediaAnalysisAdapterTests`) fail regardless of cwd for a
  different, now-precisely-understood reason: `locate_media_analysis()`'s checkout-discovery
  fallback checks `Path.cwd().parent / "media-analysis-skill"` unconditionally — it is **not**
  parameterized by the function's own `explicit`/`env` arguments — so a test that passes
  `explicit="/nonexistent"` and `env={"PATH": "/nonexistent"}` to assert "not locatable" still
  finds the real `/home/user/media-analysis-skill` checkout sitting next to cwd. This is the
  same class of thing as the earlier editable-install lesson in this document: a deliberate,
  documented convenience feature (run from inside a sibling-checkout layout, zero env vars) that
  a test written for a clean/CI environment can't isolate against in this exact sandbox layout —
  not a product bug, and not something to change in `video-production-agent`'s own code (that
  would mean ripping out the convenience feature this whole document has been verifying is
  real). Recorded here so a future session doesn't have to re-derive this a third time.
- Closed the subtitle-skill gap from the previous entry: built a real speech test asset
  (`espeak-ng` → WAV → muxed onto a color video with `ffmpeg`, since the sandbox has no
  pre-recorded speech sample) instead of settling for "needs a real speech clip, not verified
  further." Two real sandbox blockers had to be fixed first, both genuinely environment-level,
  not product bugs: (1) `espeak-ng` wasn't installed (`apt-get install -y espeak-ng`); (2)
  `--kind transcript` without `--offline` failed with a TLS certificate error fetching the
  faster-whisper model from huggingface.co — `curl --cacert /root/.ccr/ca-bundle.crt` to the
  same host succeeded, isolating it to `huggingface_hub`'s HTTP client trusting its bundled
  `certifi` CA list over the proxy's `REQUESTS_CA_BUNDLE`/`SSL_CERT_FILE` env vars; fixed by
  appending the proxy's CA cert to certifi's own `cacert.pem` (additive, standard workaround for
  this exact certifi-bypass class of issue). With both fixed: `video-agent plan <speech.mp4>
  --set subtitle=true --kind transcript` produced a real, correct transcript (2 segments,
  language `en`) via a genuine `faster-whisper` run — not fabricated: the recognised text closely
  matches the `espeak-ng` script word-for-word. `render` completed with a real `.srt` `CAPTIONS`
  artifact, QA `PASS`. Separately verified `subtitle.burn_in=true` (with a `motion.text` overlay
  step providing the required intermediate — burn-in correctly `BLOCK`s without one, "burns into
  inputs inside the agent workspace only... the input would be the untouched source", the same
  ADR-022 workspace-boundary reasoning as `WORK_QUEUE.md` item 9, but proactively refused up
  front here rather than silently producing nothing): the rendered `MASTER` genuinely has the
  transcript text burned into the picture — extracted a frame and visually confirmed the caption
  text is really there, not just claimed. `subtitle-skill` is now the sixth Skill/tool pair
  (after ffmpeg-skill/loudness, color-grading, qc, motion-graphics, thumbnail, audio-production)
  confirmed genuinely executable end to end in this session, closing the last "not yet verified
  for real" gap this document was tracking.
- `video-production-agent` PR #33 (**merged**): while re-verifying PR #32's fix for real (a
  `--set motion.text=...` no-preset render), noticed the newly-registered `MASTER` Artifact's
  `operations`, `decision_ids` and `step_id` were all empty/`None` — as if nothing had produced
  or decided it, even though it is the direct, real output of a real motion-graphics operation.
  Root cause: `_register_artifacts()`'s producing-op lookup matched purely by id
  (`logical in o.outputs or logical in o.inputs`), which a no-preset deliverable never satisfies
  because `compiler.py`'s `delivery()` aliases its path to "the last processed intermediate's"
  own path rather than any op naming the delivery id itself. Fixed by also matching an operation
  whose own output resolves (via `paths`) to the same on-disk path, and by always crediting the
  delivery target's own `decision_ids` (already available from the planner) regardless of match.
  `tool`/`tool_version` are left empty on purpose for this case (no dedicated export op exists to
  attribute the file to) — a real, narrower, lower-priority gap, not addressed here. Verified for
  real: the same render now reports the real op id and both decisions involved instead of `[]`/
  `[]`. New regression test extends #32's own test. Full suite: 308 passed, same 4 pre-existing
  environmental failures, 0 new regressions.
- `video-production-agent` PR #34 (**merged**): closed the "QC never runs on a no-preset
  delivery" half of the finding above for good — root-caused one layer deeper than PR #32
  reached: `agent/planner.py`'s `qc_steps()` never planned a qc step for a no-preset target at
  all (it only creates one alongside a `delivery_export` step, preset-only), so there was never
  a tool selection for the compiler to find. Fixed across all three coordinated layers
  (`planner.py` plans the step against the subject's own media, `compiler.py`'s `qc_gate()`
  compiles it, `qa/checks.py`'s `run_qa()` looks it up correctly) and verified for real with
  qc-skill: an untouched no-preset request now runs a genuine, admitted qc check against the
  real source (6 real QA checks instead of 0); a processed no-preset request now gets the same
  real gate against the real processed file and correctly promotes to `approved` instead of the
  honest-but-incomplete FAIL PR #32 left behind. New real-Skill regression test
  (`test_s11_qc_gate_without_a_delivery_preset`). While validating this by running the suite
  from inside the checkout (its own sibling-discovery needs that — a `/tmp` run skips every
  real-Skill test entirely, silently), also caught and fixed a second, unrelated pre-existing
  gap: `AudioProductionRealTests::test_two_inputs_concat_mono_normalize_end_to_end` still
  asserted the pre-#32 buggy "no artifact registered" behavior as correct, undetected until now
  because it needs a real audio-production-skill checkout. Full suite (from `/tmp`): 308 passed,
  same 4 pre-existing failures; real-Skill classes (from inside the checkout):
  `AudioProductionRealTests` 5/5, `IntegratedPipelineRealTests` 11/11, 0 regressions. The only
  piece of this whole finding still open is registering an Artifact for a genuinely untouched
  deliverable — `WORK_QUEUE.md` item 9, now scoped to exactly that and nothing else.
- Personally drove `video-editing-skill`'s `concat` end to end for the first time this session
  (the automated suite already covered it, but not a live run) — two generated clips,
  `--set edit.concat=true`, generic profile, no delivery preset. A real `video-editing/concat`
  call completed, but `report.json` still showed `"artifacts": []`: the same bug PR #32 fixed,
  back again for a concat programme specifically. `video-production-agent` PR #35 (**merged**):
  root cause was one level more specific than PR #32's fix reaches — `compiler.py`'s
  `delivery()` decided whether to alias the deliverable by comparing
  `state[subject]["current"] != subject`, which correctly detects "untouched" for a single
  source (current stays the raw asset id) but is never true for a concat/`audio_concat`
  programme, whose subject id *is* the id of a real op output from the moment concat runs — so
  the alias (and therefore Artifact registration, and the PR #34 QC gate) never fired for a
  programme, no matter what processed it. Fixed by checking `st["current"] not in d["assets"]`
  instead (true exactly when current isn't one of the original raw sources), which correctly
  covers both cases. Verified for real: the same concat render now registers a `MASTER`
  artifact crediting the real `video-editing/concat` op and decision, and adding `qc=true`
  now runs a genuine qc-skill check against the real concatenated file, correctly promoting the
  artifact to `approved`. New fast unit regression test. Full suite (from `/tmp`): 309 passed,
  same 4 pre-existing failures; real-Skill classes (from inside the checkout, unaffected):
  `VideoEditingRealTests` 2/2, `AudioProductionRealTests` 5/5, `IntegratedPipelineRealTests`
  11/11 — 0 regressions across every scenario touching concat, video or audio.
- The one remaining piece of `WORK_QUEUE.md` item 9 — registering an Artifact for a genuinely
  untouched (nothing processed at all) no-preset deliverable — needed real cross-repo work,
  since `ArtifactStore.check_path()` (ADR-022) correctly refuses to register an untouched
  source's own external path, and no operation existed to materialize it into the workspace
  without a needless re-encode. `ffmpeg-skill` PR #27 (**merged**) added exactly that: a real
  `export.py --preset copy` (`-c:v copy -c:a copy`, no re-encode; keeps the source's own
  extension when `-o` doesn't name one; skips the CFR-conforming and BT.709-retagging steps
  every re-encoding preset applies, and never issues the HDR SDR-flattening warning, since
  neither is meaningful without decoding the picture; `-movflags +faststart` still applies
  when the resolved output is `.mp4`). Verified for real: codec/resolution/audio-presence/
  frame-count (via `ffprobe -count_frames`, which a re-encode could silently drop/duplicate)
  and HDR tags all stay byte-for-byte the source's across three real scenarios (video+audio,
  video-only, HDR `.mov`). Full ffmpeg-skill suite: 71 passed, 1 skipped; contract suite: 32
  passed, 1 skipped.
- `video-production-agent` PR #36 (**merged**): wired the new preset in. `compiler.py`'s
  `delivery()` now materializes a genuinely untouched, video-capable subject into the job's
  `artifacts/` directory via a real `delivery_export` op (`preset="copy"`) instead of doing
  nothing, and `planner.py`'s `delivery_steps()` plans the matching `ProductionStep` so the
  compiler has a tool selection to compile against (same ADR-021 shape the PR #34 QC fix
  needed). The already-fixed processed no-preset case (PR #32/#33/#35's alias) is untouched.
  A genuinely untouched *pure-audio* subject on the audio-production path is deliberately
  excluded — `export.py --preset copy` requires a video stream, so that narrower edge case
  still falls through to the pre-existing (unregistered) behavior rather than crashing, and
  isn't otherwise known to be reachable today. Verified for real: rewrote
  `IntegratedPipelineRealTests` Scenario 11 to assert a genuinely untouched no-preset request
  now gets one real stream-copy `delivery_export`, a real registered Artifact
  (`MASTER`/`source`/`PASS`, credited to `ffmpeg-skill/export`), and a real qc-skill gate
  against the delivered (copied) bytes rather than the untouched source directly — against
  real ffmpeg-skill, motion-graphics-skill and qc-skill. New fake-adapter unit test for fast
  regression coverage. `tests/test_unit.py`: 188 passed (2-4 environmental failures depending
  on cwd, unrelated, unchanged from before); `tests/test_integration.py`: **45 passed, 0
  skipped**, every real-Skill class, 0 regressions. `WORK_QUEUE.md` item 9 is now fully
  closed — both halves of its own title ("produces no Artifact" and "skips QC") are fixed.
- Searching for the next real gap after item 9 (a real, generated multi-target `conference`
  profile render and `deliver` both worked cleanly first try) surfaced a new one: a plan
  against a real, untrimmed clip (no leading/trailing silence — a screen recording, B-roll,
  anything that starts/ends mid-sound) failed outright on both `plan` and `render`:
  `temporal scope {...} exceeds asset duration ...`. Root cause: a scope meant to cover an
  asset's whole duration is built via `round(dur, 3)` (`agent/planner.py`), which can round
  *up* past the raw probe duration by up to `5e-4`s; `TimeRange.within()` then compared that
  against the raw duration with `TIME_EPS` (`1e-6`) — 500× tighter than the rounding error
  that produced the value in the first place. Not synthetic-media-only: an exact multiple of
  0.001s is essentially never a real recording's true length, so roughly half of all real,
  untrimmed footage hits this; every asset tested earlier this session happened to either
  have an exactly round `lavfi` duration or leading/trailing silence whose trim shifted the
  scope below the raw duration, masking the bug both times. Fixed via
  `video-production-agent` PR #37 (**merged**): `within()` now uses a dedicated
  `DURATION_EPS = 0.01`, matching `project/validator.py`'s own already-established tolerance
  for the same class of check; `TIME_EPS` itself and every other temporal relation are
  untouched. Verified by reproducing the exact failure directly and via a full
  plan+validate+render regression (confirmed failing before the fix, passing after). New
  regression tests added. `tests/test_unit.py`: 187 passed (4 known environmental failures,
  unrelated); `tests/test_integration.py`: **45 passed, 0 skipped**, every real-Skill class,
  0 regressions. Tracked as `WORK_QUEUE.md` item 10, now resolved.
- Continuing the search: a burned-in caption on a portrait (1080x1920) clip looked
  dramatically oversized versus landscape on visual inspection, and a fix was drafted
  (`ffmpeg-skill caption.py`'s `subtitles=` filter given an explicit `original_size`). Before
  committing, rigorous per-line pixel measurement (isolating individual wrapped lines, then
  retesting with single-word unwrappable text across a dozen resolutions/aspect ratios)
  proved this was **not a real bug**: the test caption text simply didn't fit the narrower
  portrait width at the given font size and correctly wrapped to two lines, which measured as
  one combined block looked ~2-3x taller — but each individual line's height was
  proportionally identical to landscape (within ~2%) everywhere. The draft fix was reverted
  before commit; recorded in `WORK_QUEUE.md` item 11 so this false lead isn't re-investigated.
- The same search surfaced a real one: an explicit `--set audio.normalize=true --set
  audio.loudness.target_lufs=-16` request on a real, audio-less clip (muted b-roll, a screen
  recording without a mic) planned and rendered cleanly, but `plan`'s decision list, `explain
  --decision audio.loudness`, and the final `report.md` all showed zero mention of loudness
  anywhere — the request simply vanished. Root cause: `agent/decision.py`'s entire
  `audio.loudness` block was gated on `asset.technical.get("audio")`, so no `Decision` was
  ever created when false — unlike `audio.production`'s analogous case, which explicitly
  `BLOCK`s with a reason. Fixed via `video-production-agent` PR #38 (**merged**): an explicit
  `SKIP` decision now explains why, matching `audio.production`'s pattern. Verified for real
  (reproduced the exact silent disappearance before the fix, confirmed the decision now
  appears in `plan`/`explain`/`report.md` after). New regression test with
  `FakeAdapter(audio=False)`. `tests/test_unit.py`: 188 passed (4 known environmental
  failures, unrelated); `tests/test_integration.py`: **45 passed, 0 skipped**, every
  real-Skill class, 0 regressions. Tracked as `WORK_QUEUE.md` item 11, now resolved.
- Continuing the search, found a natural-language-layer version of the same "silent
  disappearance" bug class: `agent/requirements.py`'s `KEYWORDS` pass has extracted a named
  platform from free text (`"youtube"` → `delivery.platform="youtube"`) since it was written,
  and the capture genuinely works — `--request "please upload this to youtube"` really adds
  the requirement to `project.json` — but nothing ever consumed it (`grep -rn
  '"delivery.platform"' src/` found only its own definition). `delivery.targets` came only
  from the profile's fixed JSON, so the request was captured and then silently discarded: the
  plan and delivered file were identical to never having named a platform. Different from the
  already-known "small hand-written phrase list" limitation (missing *coverage*) — here the
  phrase matches and is parsed, creating a false impression that it does something. Fixed via
  `video-production-agent` PR #39 (**merged**): the delivery decision loop now applies a named
  platform to the profile's own preset-less targets (the platform name is the preset name for
  the one platform this keyword pass recognizes today), the same outcome `--profile youtube`
  produces — a target that already has a preset is untouched. Verified for real: `plan`,
  `explain`, and a full `render` (real `ffmpeg-skill/export` + platform check, QA correctly
  caught the un-normalized test tone) all confirm the preset is genuinely applied; confirmed
  no interference with profiles that already choose a preset. The same PR also fixed a small,
  independently-found `explain` crash: `--decision`/`--step`/`--context`/`--observation`/
  `--pipeline` raised a raw `NoneType` Python error instead of a clear message when the
  optional `PROJECT` argument was omitted (`cmd_explain` called `load_ir(args.project)`
  unconditionally except in `--artifact` mode) — fixed with an explicit upfront check. New
  regression tests for both. `tests/test_unit.py` + `tests/test_requirements.py`: 196 passed
  (4 known environmental failures, unrelated); `tests/test_integration.py`: **45 passed, 0
  skipped**, every real-Skill class, 0 regressions. Tracked as `WORK_QUEUE.md` item 12, now
  resolved.
- The same systematic method (grep every key `agent/requirements.py`'s
  `KEYWORDS`/`NUMERIC_KEYWORDS`/`defaults` can produce, check each has a real consumer) found
  one more: `delivery.preserve_source` was added to every plan (`defaults` dict, always
  `True`), and a user could also explicitly `--set delivery.preserve_source=false` — with zero
  effect either way. `grep -rn preserve_source src/` shows the only real thing by this name is
  `policy/rules.py`'s hardcoded, non-overridable `sys.preserve_source` CONSTRAINT ("never
  write to the source path", ADR-022's workspace boundary, enforced structurally by
  `ArtifactStore.check_path()`). Unlike `delivery.platform`, this key duplicates a
  deliberately non-negotiable safety constraint, so wiring it to do something would be the
  wrong fix (it would mean building a way to weaken ADR-022's boundary) — worse than merely
  dead, since a user could believe the `--set` disables a real guarantee it never touched.
  Fixed via `video-production-agent` PR #40 (**merged**): dropped the always-present default,
  and an explicit `--set delivery.preserve_source=...` is now rejected with the same "unknown
  requirement key" error as any other unsupported key. Verified for real: a default plan no
  longer lists the key; the explicit `--set` now fails clearly instead of silently no-opping.
  New regression test. `tests/test_unit.py` + `tests/test_requirements.py`: 197 passed (4
  known environmental failures, unrelated); `tests/test_integration.py`: **45 passed, 0
  skipped**, every real-Skill class, 0 regressions. The same audit confirmed every other
  requirement key traces cleanly to a real consumer — no further dead keys found. Tracked as
  `WORK_QUEUE.md` item 13, now resolved.
- Applying the same "grep every field, verify a consumer" method to `profiles/*.json` instead
  of requirement keys, this round (the 5th consecutive gap-hunting pass) found one more, minor
  item: `generic.json` carried a dead top-level `"semantic_deletion": "CONFIRM"` scalar that
  `profiles/loader.py` merges into `Profile.data` but nothing ever reads — `conference.json`
  expresses the same safety intent correctly as a real `Rule`
  (`edit.semantic_deletion.approval`). A leftover from an earlier schema draft, never migrated.
  Lower severity than the two requirement-key bugs above since nothing lets a user set this via
  `--set` — it never misleads a live request, just sits unused in every `project.json` of the
  default profile. Fixed via `video-production-agent` PR #41 (**merged**): removed (not
  migrated, since the underlying Phase 4 Skill isn't selectable yet). New regression test.
  `tests/test_unit.py` + `tests/test_requirements.py`: 198 passed (4 known environmental
  failures, unrelated); `tests/test_integration.py`: **45 passed, 0 skipped**, every real-Skill
  class, 0 regressions. Tracked as `WORK_QUEUE.md` item 14, now resolved. Five consecutive
  rounds of gap-hunting (items 9-14) found progressively smaller issues, with round 5 down to
  one minor inert config field — the expected diminishing-returns signal that it was time to
  pivot away from further discovery rounds toward this document's own P0.
- **Correction, immediately after writing the line above**: acting on "pivot to the P0
  bootstrap gap" turned out to mean checking the claim first, not re-doing work already done.
  `scripts/bootstrap.sh` already existed in this repository (added in the same commit,
  `ca2639e`, that first wrote this document and its P0 section — the two were simply never
  reconciled with each other) and, tested for real just now in a genuinely fresh scratch
  directory, does exactly what a bootstrap script should: clones `video-production-agent` +
  all 10 Skills as siblings, installs the Python ones, checks ffmpeg, and finishes with a real
  `video-agent doctor` showing **all 10 Skills `AVAILABLE`** — no `VIDEO_AGENT_*_DIR`
  environment variables needed. The actual gap was one level narrower than this document's own
  P0 wording claimed: the script was never linked from `README.md`'s "Quick start", which
  instead told a fresh reader "there is no installable application" and walked through the
  individual per-repo path only, so nobody reading the README top-to-bottom would ever find
  the one-command path that already worked. Fixed: `README.md`'s Quick Start now leads with
  `./scripts/bootstrap.sh` as the recommended path to the full ecosystem, keeping the
  single-Skill (`npm install -g ffmpeg-skill`) path for anyone who only wants one piece. Step
  1's table row and this section's P0 bullet above are corrected to match. Lesson for future
  sessions: before writing "still open" about a gap this document itself tracks, check the
  actual repository state, not just this document's own prior wording about it — a P0 item's
  status can go stale exactly the way any other claim in this document can.
- Asked directly whether to keep gap-hunting or follow `ROADMAP.md`'s own defined next step,
  read the roadmap in full: Phase 3 ("fix the qc-skill/media-analysis-skill collision + real
  Provider resolution") is the current, not-yet-complete phase, with item 1 (both Skills
  registering as Providers of the colliding Capability ids) already confirmed done in Phase 2,
  and item 2 (the `CAPABILITY_MODEL.md` three-tier collision policy replacing
  `SkillRegistry.select_tool()`'s hardcoded first-match-wins) confirmed **not** done by reading
  the source directly. Confirmed this was a real, live gap — not hypothetical — by reinstalling
  all 10 Skills fresh and running `video-agent skills`: with both packages genuinely installed,
  `media_probe` / `silence_analysis` / `loudness_analysis` / `silence_cleanup` all silently and
  unconditionally resolved to `ffmpeg-skill/*`, with zero way for a user to choose otherwise.
  Implemented the full three-tier policy (explicit `--set provider.<skill>=<package>` → a new
  `skills/providers.py`'s OS-level default, overridable via a workspace `providers.json` → loud
  refusal naming the real candidates) via `video-production-agent` PR #42 (**merged**),
  preserving zero-config backward compatibility (the OS-level default reproduces today's
  ffmpeg-skill-wins choice exactly) while genuinely closing the "silent, hardcoded,
  unconfigurable" gap the roadmap named. Three pre-existing tests that relied on declared-order
  mutation to force a selection were updated to use the new explicit mechanism instead — the
  point of this fix is precisely that declaration order should no longer be how a real
  collision gets resolved. `tests/test_unit.py`: 197 passed (4 known environmental failures,
  unrelated, confirmed identical on `main` before this change via `git stash`).
  `tests/test_integration.py` (real ffmpeg + all 9 real Skills, no mocks): **48 passed, 0
  failed** (up from 45, +3 new covering the real collision end-to-end), directly answering this
  roadmap phase's own risk note to re-verify against a real baseline rather than the unverified
  self-reported count. Also verified live via manual CLI/Python checks against a real
  bootstrapped environment (default unchanged, explicit override works, unknown provider name
  fails loudly with the real candidate list, workspace `providers.json` default works).
  `ROADMAP.md` updated to CURRENT/IMPLEMENTED for both Phase 3 items; tracked as
  `WORK_QUEUE.md` item 15, now resolved.
