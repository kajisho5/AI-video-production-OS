# Work Queue — prioritized, grounded in real gaps

**Status: CURRENT / IMPLEMENTED** (this document; the queue itself, not the work it
lists — items below range from PLANNED to VISION until actually started). Ordered by the
priority this project operates under: Mission > User value > Ecosystem health >
Architectural integrity > Reliability > Security > Interoperability > Developer experience
> Creator sustainability > Profit maximization. An item's position here reflects that
ordering plus how well-scoped and low-risk it is *right now* — a high-mission-value item
that isn't yet investigable moves down until it is.

## 1. Investigate: can `video-production-agent`'s registry be *expressed* via `provides`, without a rewrite?

**Why this is first**: per `DECISION_LOG.md` D1/D4, this is the highest-leverage open
question in the ecosystem — the Agent's own Phase-4-equivalent problem is already solved,
by a different, real, working mechanism. Understanding whether that mechanism *could*
consume this project's `provides` field (additively, without touching its proven behavior)
determines whether `docs/ROADMAP.md` Phase 4 as originally scoped is still needed at all,
or whether it should be rewritten to describe a thin connecting layer instead.

**Concretely**: for each of `video-production-agent`'s `SkillSpec.tools` candidate lists
(e.g. `silence_cleanup`'s `["ffmpeg-skill/cut", "video-editing/cut"]`), check whether the
Capability id each candidate Skill now publishes under `provides` (once the rollout fully
merges) matches what the Agent's own hand-written `SkillSpec` already assumes. If they line
up cleanly across all ~30 registered `SkillSpec`s, a **read-only diagnostic** (e.g. `video-agent
skills --check-provides`, comparing the hand-written registry against each package's live
`provides` for drift) is a safe, additive, real next step — never a replacement for the
registry itself. If they don't line up, that mismatch is itself the finding to report, not
to silently paper over.

**Boundary**: this is investigation and, if warranted, an additive diagnostic — not a
rewrite of `SkillRegistry.select_tool`. Do not change Agent selection behavior as part of
this item.

**Investigated 2026-09-05 (complete for naming; tool-candidate mapping spot-checked, not
exhaustively simulated):**

Enumerated all 42 registered `SkillSpec`s (`default_registry()`) and every real Skill's
`contract.SKILL_ID`. Of the 10 Skills, **7 use the same id as their agent-internal package
id** (`ffmpeg-skill`, `video-editing` ↔ `video-editing-skill`'s real `SKILL_ID =
"video-editing"`, `audio-production`, `color-grading`, `motion-graphics`, `qc`,
`media-analysis` — all already match) and **3 do not**:

| Skill | Real `contract.SKILL_ID` | Agent's internal package id |
|---|---|---|
| `subtitle-skill` | `subtitle-skill` | `subtitle` |
| `thumbnail-skill` | `thumbnail-skill` | `thumbnail` |
| `transcription-skill` | `transcription-skill` | `transcription` |

All three mismatches are explicit and commented in the adapter source (e.g.
`transcription/adapter.py`: `"package id in the agent's registry == tool id prefix"`) —
**deliberate, working, not a bug.** The adapter correctly maps its own internal tool id to
the Skill's real operation name at call time (e.g. `op_type = "generate" if tool ==
TOOL_GENERATE else "render"`, then calls the Skill through its real contract) — the
mismatch never reaches the actual Skill invocation.

**Consequence for any future `provides`-based diagnostic**: it **cannot compare tool-id
strings directly** — `"subtitle/generate"` (Agent) will never literal-match
`"subtitle-skill/generate"` (the Skill's own `provides[].tool_id`) for these 3 of 10
Skills. The Capability id itself (`"subtitle.generate"`) is the correct join key instead:
it is independent of either side's internal naming, and already maps closely to the
Agent's own production-skill concept (`subtitle_generation` ↔ `subtitle.generate`,
`thumbnail_render` ↔ `thumbnail.render`, `speech_transcription` ↔ `transcribe.audio`).
**A future diagnostic (or connecting layer) must be built against Capability id, never
tool-id string equality, or it will silently misreport these 3 Skills as non-compliant
when they are not.**

Two registered production skills also have genuine multi-candidate tool lists — the actual
collision-shaped cases in the Agent's own registry — worth checking explicitly once the
`provides` rollout fully merges: `media_probe` (`["ffmpeg-skill/probe",
"media-analysis/probe"]`) and `silence_analysis`/`loudness_analysis` (same two-way split).
None of the Agent's registered `SkillSpec`s list `qc-skill` as an alternative candidate for
any `media-analysis-skill`-served skill — consistent with, though not yet confirmed as
deliberate proof of, the role-separation hypothesis in item 5 below.

**Investigated 2026-09-06 (exhaustive — every Agent tool candidate against every real
`provides[]` entry, now that all 10 rollout PRs are merged):**

Ran each of the 10 Skills' own `capability_provides()` (or equivalent) directly against
its real, merged `main` source (a detached worktree per repo, not the pinned adapter
fixtures) to get every real `{id, tool_id}` pair, then checked every one of the 42
`SkillSpec.tools` candidates in `default_registry()` against it. Two real, load-bearing
findings emerged that the 2026-09-05 spot-check could not see without the merged data —
both are naming drift, **neither is a live bug**, both are exactly what the Capability-id
warning above predicted:

1. **`qc_check`'s tool candidate (`"qc/check"`) does not exist in `qc-skill`'s real
   `provides[]` at all.** Every one of `qc-skill`'s 10 published Capability ids
   (`measure.audio.loudness`, `measure.video.format`, ...) shares one single real tool id,
   `"qc/run"` — `qc-skill`'s own contract has never had a `"qc/check"` operation name.
   `video_agent/tools/qc/adapter.py` already documents why, in its own words (line 25):
   *"the contract declares operations [inspect, check, validate] but no tool ids; the
   agent defines qc/check and qc/inspect."* The adapter builds its `SkillPackage`'s
   `ToolSpec`s directly from those two Agent-invented ids (`TOOL_CHECK`, `TOOL_INSPECT`),
   never from the Skill's own `tools`/`provides` output — so `SkillRegistry.select_tool()`
   still works today (the Agent's own registered package really does declare and support
   `"qc/check"`), but a naive provides-based diagnostic joining on tool-id string would
   report `qc_check` as "tool not found," which would be **wrong**: the real join, by
   Capability id, is unambiguous (`qc_check`'s intent maps to `measure.delivery.integrity`
   / the QC gate role generally, per item 5's ADR-032 finding).
2. **`subtitle_generation`/`subtitle_burn_in`'s tool candidates (`"subtitle/generate"`,
   `"subtitle/render"`) do not literal-match `subtitle-skill`'s real `provides[].tool_id`
   (`"subtitle-skill/generate"`, `"subtitle-skill/render"`)** — `video_agent/tools/
   subtitle/adapter.py` hardcodes the short prefix (`SKILL_ID = "subtitle"`, matching the
   already-known package-id mismatch above), building its own `ToolSpec`s the same
   self-declared way `qc`'s adapter does, not derived from the contract. Same consequence:
   works today (self-declared), would false-positive a naive tool-id diagnostic, resolves
   cleanly by Capability id (`subtitle.generate`, `subtitle.render` — exact 1:1 match with
   the Agent's own `SkillSpec` names).

   By contrast, **`thumbnail-skill`'s real tool ids (`"thumbnail/render"`,
   `"thumbnail/extract_frame"`) already literal-match** the Agent's candidates exactly,
   despite the same *package*-id mismatch (`thumbnail-skill` vs `thumbnail`) — proving the
   package-id mismatch table above does not, by itself, predict a tool-id mismatch. Only
   Capability id is a reliable predictor either way.

   All three of `color-grading`, `audio-production` and `motion-graphics`'s adapters
   correctly reference (or, for `audio-production`, read live from the contract) the
   Skill's own real single generic tool id (`"<skill>/run"`) — no drift there, because
   unlike `qc`/`subtitle`, these three adapters do not invent their own tool-id naming.

3. **The two-way "candidate" `SkillSpec`s (`media_probe`, `silence_analysis`,
   `loudness_analysis`) are NOT Capability collisions in `CAPABILITY_MODEL.md`'s sense.**
   Each candidate pair maps to two genuinely **different** Capability ids from two
   different Skills (`media_probe`: `ffmpeg-skill.probe` vs `measure.media.probe`;
   `silence_analysis`: `ffmpeg-skill.silence` vs `measure.audio.silence`;
   `loudness_analysis`: `ffmpeg-skill.loudness` vs `measure.audio.loudness`) — never the
   *same* id published by two Providers. This is an Agent-internal "try a fallback tool"
   mechanism (`SkillRegistry.select_tool()` walks `tools` in declared order until one is
   supported), unrelated to and does not need `registry.CapabilityRegistry`'s
   collision-resolution policy at all. The ecosystem's one real, already-documented
   Capability collision (`measure.audio.loudness` / `measure.audio.silence` /
   `measure.audio.integrity`, both published by `qc-skill` and `media-analysis-skill` —
   `registry/README.md`) is not reachable from the Agent's registry today: no registered
   `SkillSpec` lists `qc-skill` as an alternative candidate for anything
   `media-analysis-skill` serves — **now confirmed**, not merely consistent with, item 5's
   role-separation hypothesis (qc-skill is architecturally the delivery-acceptance gate,
   never an interchangeable measurement Provider).

4. **Two real capability gaps, not mismatches**, worth surfacing for future roadmap
   prioritization rather than fixing here (out of this item's boundary): `video-editing-
   skill` publishes `video.trim` (`tool_id: "video-editing/trim"`) with **no** corresponding
   `SkillSpec` anywhere in `default_registry()` — a real, working capability the Agent
   cannot select today. `audio-production-skill` similarly publishes five capabilities the
   Agent's nine `audio_*` `SkillSpec`s never reference: `audio.dynamics`, `audio.mix`,
   `audio.noise_reduction`, `audio.silence_remove`, `audio.trim`.

5. **All other ~30 of the 42 `SkillSpec`s' tool candidates line up cleanly**, by both
   tool-id string *and* Capability id, with what the corresponding Skill's real merged
   `provides[]` publishes — including every `ffmpeg-skill/*`, `video-editing/*` (other than
   `trim`), and `media-analysis/*` reference the Agent declares.

**Conclusion for this item's own question** ("is `docs/ROADMAP.md` Phase 4 as scoped still
needed, or should it be rewritten as a thin connecting layer?"): **Phase 4 as scoped is
still the right shape, not rewritten.** `SkillRegistry.select_tool()` is a declarative
availability/fallback layer; real execution routing still goes through `Service.adapter()`
→ `ToolRouter` (`video_agent/service.py`, `tools/router.py`), exactly the hardcoded wiring
Phase 4's own text already targets — nothing in this investigation contradicts that
premise. What this investigation *does* newly support, concretely: a small, **separate**,
read-only diagnostic (`video-agent skills --check-provides` or similar) joining on
Capability id is now genuinely buildable with real, useful output on day one — it would
correctly flag findings 1–2 as "self-declared, contract does not confirm" (informational,
not an error) and findings 4 as "Capability published, no SkillSpec consumes it yet." That
diagnostic is lower-risk, additive tooling, separate from and no substitute for Phase 4's
actual execution-model work — building it is a new, well-scoped candidate for a future
item in this queue, not something this investigation implements (per this item's own
Boundary).

## 2. ~~Land the remaining `provides` rollout PRs~~ — DONE 2026-09-06

All 10 Skills' `provides` PRs merged. The last four (`subtitle-skill#2`,
`ffmpeg-skill#24`, `color-grading-skill#4`, `qc-skill#5`) required draft removal + merge;
the latter two had developed real merge conflicts against sibling feature PRs that
landed first in the same repos, each fixing a real gap the conflict exposed (a missing
Capability id; 7 unaccounted-for checks) rather than a purely textual resolution — see
`DECISION_LOG.md` D7 and `docs/ecosystem/capability-status.json` for the evidence.
`docs/ecosystem/WORK_QUEUE.md` item 1's broader tool-candidate mapping simulation (which
explicitly waited for this) can now proceed.

## 3. ~~`registry/` conformance harness: real per-Skill wiring~~ — DONE 2026-09-05

All 8 of `SKILL_SPEC.md` §8's checks are now real functions in `registry/conformance.py`
(50 tests total, all passing — see `registry/README.md`).

- `forbidden_keys_rejected`, `doctor_status`, `workspace_confinement` and
  `no_clobber_input` (4 process-based checks) verified end-to-end against a real
  `qc-skill` process (`registry/tests/test_conformance_live.py`, 11 tests, skipped when
  `qc` isn't on `PATH`).
- `no_unsafe_shell_out` implemented via a static AST walk of a Skill's own Python source
  tree (SKILL_SPEC.md section 4.3's pattern) — manually verified **PASS against all 9
  real Python Skills** in the ecosystem (qc-skill, media-analysis-skill,
  video-editing-skill, audio-production-skill, color-grading-skill,
  motion-graphics-skill, thumbnail-skill, subtitle-skill, transcription-skill). Does not
  cover `ffmpeg-skill` (Node.js, not Python) — a language-appropriate lint-rule
  equivalent is real future work, not built here.

Three findings worth recording, each caught by testing against real ecosystem source
rather than trusting the first implementation:
- The first `forbidden_keys_rejected` implementation assumed every Skill's failure
  envelope carries `ok: false`, but `qc-skill`'s real responses use `status: "failed"`
  with no `ok` key at all — `_is_rejected()` now checks both real conventions this
  ecosystem actually uses.
- `workspace_confinement` and `no_clobber_input` were originally scoped as "submit a
  request whose output path is outside the workspace / equals an input path, and check
  it's rejected" — the same shape as `forbidden_keys_rejected`. Live testing against
  `qc-skill` found this doesn't fit: its `run` request schema has **no output-path field
  at all** (its `validate`/`inspect`/`check` operations are read-only measurement
  returning a report on stdout; its on-disk report cache writes to a fixed,
  non-request-controlled path via a `PathPolicy.resolve_output()` method that is defined
  but never actually called anywhere in the codebase — confirmed by grep). Redesigned
  instead around properties observable from outside the process for *any* Skill:
  `workspace_confinement` snapshots caller-chosen directories outside the declared
  workspace before/after a real run and fails if any gained a file;
  `no_clobber_input` hashes the input fixture before/after and fails if it changed.
- `no_unsafe_shell_out`'s first draft used a text/regex scan and produced two real false
  positives on its first run against actual ecosystem source: `qc-skill`'s `rules.py`
  merely *mentions* "eval()/exec()" inside a comment documenting they're forbidden, and
  several Skills pass the safe, explicit `shell=False` — both looked identical to a real
  violation to a regex but not to an AST (a comment/docstring is a string literal, never
  a `Call` node; `shell=False` is a `Constant` the check can resolve and clear). Switched
  to a full AST walk, which also now conservatively flags a non-literal `shell=` value
  (one it cannot statically prove is always `False`) rather than assuming it's safe.

**Not done, and out of scope for this item:** wiring any of these 8 checks into an
actual CI job in any Skill's own repository — each is a real, callable function today,
not yet an automated gate anywhere. That would be a per-Skill PR (adding a conformance
CI step), a different and separate piece of work from building the checks themselves.

## 7. ~~Ecosystem Dashboard (`dashboard/`)~~ — LIVE 2026-09-06, verified against the real deployed site

Built per an explicit user request: a read-only, mobile-first, PWA-ready web dashboard
over the ecosystem's real GitHub state. See `dashboard/README.md` and
`docs/adr/ADR-011-ecosystem-dashboard.md` for the architecture, `docs/ecosystem/
MATURITY_MODEL.md` for the maturity ladder it renders. 61 tests, all passing, no network
access required by any of them.

**GitHub Pages is enabled and the site is genuinely live**, confirmed by fetching
`https://kajisho5.github.io/AI-video-production-OS/data/ecosystem-snapshot.json`
directly (2026-09-06) and finding data this session never fed it: a real open PR count
and a real PR-body detail on `video-production-agent` (a merge conflict on a real,
specific PR number about multi-source sync) neither present in, nor derivable from, the
fixture snapshot committed to this repository, plus a `generatedAt` timestamp
independently later than that committed fixture's own commit time. Not a hypothesis —
directly observed.

**Correcting this item's own earlier assumption**: the previous text here expected "the
workflow's first real run will overwrite [the committed fixture] with genuinely live
data." That was wrong about the mechanism, not just unconfirmed: `.github/workflows/
dashboard.yml` only builds a snapshot in-memory during the run and uploads it straight to
GitHub Pages via `actions/upload-pages-artifact` — it never commits anything back to this
repository. **The committed `dashboard/web/public/data/ecosystem-snapshot.json` will
correctly stay a development-time fixture forever**, by design (it exists only so
`dashboard/web` has something to render locally and in its own tests) — this is not a gap
to watch for, and no future check should expect that file to start reflecting live state.

**Remaining real gaps, in rough priority order**:
- ~~No live npm/PyPI version lookup yet~~ — DONE 2026-09-06: `dashboard/aggregator/src/
  packageRegistry.ts` performs a real live lookup; see `docs/ecosystem/MATURITY_MODEL.md`
  level 6 and `dashboard/README.md`.
- No snapshot history/trend view (deliberately deferred, per `MATURITY_MODEL.md`'s own
  "deliberately not part of this model" section).
- `capability-status.json`'s documented (non-automatic) fields will drift from reality
  over time unless updated in the same commit as the prose docs they mirror — this is
  the accepted, explicit limitation ADR-011/MATURITY_MODEL.md already name, not a new
  finding, but worth remembering the next time `CROSS_REPO_STATUS.md` changes.

## 4. ~~A standalone JSON Schema file for the CapabilityContract's `provides` shape~~ — DONE 2026-09-06

`registry/capability_contract.schema.json` (draft 2020-12), `registry/schema.py`'s
`load_schema()`, and 12 new tests (`registry/tests/test_schema.py`) — see
`docs/ROADMAP.md` Phase 1 item 1 and `registry/README.md` for the full description. Real
value for any non-Python consumer (a third-party Skill author who wants to validate their
own `provides` output without importing this project's Python code) now exists, not just
proposed.

## 5. ~~Confirm or refute the qc-skill/media-analysis-skill "collision avoidance by role separation" hypothesis~~ — RESOLVED 2026-09-05

**Confirmed deliberate.** `video-production-agent`'s ADR-032 states explicitly that
`qc-skill` is connected as "the final promotion gate" — architecturally scoped as the
delivery-acceptance gate, never as an alternative per-measurement Provider to
`media-analysis-skill`. Not an accident of build order. See `CURRENT_STATE.md`'s
"Resolved" section for the citation. No further action needed on this item.

## 6. VISION-tier, not yet actionable: AI Provider connection

The single biggest gap between "what this ecosystem can do" and "what the Mission
describes" (natural-language intent → plan) is that no real LLM reasoning is wired into
`video-production-agent` — only `NullProvider`. This is real, important, and explicitly
out of scope for immediate action: it is `video-production-agent`'s own architecture to
extend (its `AI Provider contract`, ADR-018, already defines the boundary — "AI proposes,
never executes"), not something this project should implement unilaterally inside another
repository. Track it here as the thing to watch for, not a task to start.

## 8. ~~A read-only `--check-provides` diagnostic for `video-production-agent`~~ — DONE 2026-09-06

**Built, in `video-production-agent` itself** (not this repository — see this item's own
original scoping below, still the right call):
[`kajisho5/video-production-agent#27`](https://github.com/kajisho5/video-production-agent/pull/27)
(merged 2026-09-06).
`src/video_agent/skills/diagnostics.py`'s `check_provides()`/`check_all()` join a Skill's
real `provides[]` against this Agent's registered `SkillPackage`/`SkillSpec` data by
Capability id, reporting `PROVIDES_VALID` / `PROVIDES_MISMATCH` / `CAPABILITY_UNCONSUMED`
/ `CAPABILITY_MISSING` / `UNKNOWN` per Capability id — pure, side-effect-free, never calls
`SkillRegistry.select_tool()` or anything in `execution/`. 16 new tests (3 of them
real-data regressions of this item's own qc-skill/subtitle-skill finding).

**Run against all 10 registered Skills' real, current `provides[]`** (captured from each
Skill's actual merged `main`, no live network): confirmed `qc-skill` (10/10) and
`subtitle-skill` (2/2) as `PROVIDES_MISMATCH`. **Traced one level deeper afterward
(`DECISION_LOG.md` D9) and split what looked like the same finding into two genuinely
different ones**: `qc-skill`'s is not drift at all — its real CLI has one `run`
subcommand, `check`/`inspect` are a field inside the request, so `provides[]`'s single
`qc/run` tool id is the *correct* granularity, and this Agent's finer `TOOL_CHECK`/
`TOOL_INSPECT` split is a deliberate, working, correctly-translated choice — collapsing
it to match would be a regression, not a fix. `subtitle-skill`'s is a real, simple 1:1
naming difference in principle, but `SKILL_ID` does triple duty (package-registry key,
tool-id prefix, and a `required_capabilities` name that must exactly match an
independently-named `CapabilityResolver` capability and two `registry.py` entries) — a
correct fix needs all of those changed together, real coordinated work, not attempted
without confirmation that specific behavior-affecting change is wanted. Confirmed
`video-editing-skill`'s `video.trim` as `CAPABILITY_UNCONSUMED` and then **closed it**:
declared `video_trim` in `default_registry()` the same safe way `multi_source_sync`/
`semantic_deletion` are (phase 2, never selectable) — re-running the diagnostic confirms
`video-editing`'s `CAPABILITY_UNCONSUMED` count dropped from 1 to 0. Found
`CAPABILITY_MISSING` nowhere across all 10 Skills. Also found something this item's own
prediction did not anticipate: `ffmpeg-skill` exposes only 12 of its real 21 capabilities
to this Agent's own reference `CATALOG` at all — 9 are reached only indirectly through
other Skills that delegate to it (by design), 3 more (`fit`/`report`/`scenes`) are known
but superseded by other Skills' own equivalents (`report`'s own before/after generator
superseded by this Agent's own `audit`/provenance mechanism).

**One prediction from this item's own text needs a correction, not a contradiction**: the
claim above that `audio-production-skill` has "five unused capabilities" (`audio.dynamics`,
`audio.mix`, `audio.noise_reduction`, `audio.silence_remove`, `audio.trim`) was reached by
manually matching each capability's internal `operation` name against `SkillSpec`
descriptions — a Skill-specific semantic reading, not something a generic diagnostic can
reproduce. `audio-production-skill` (like `color-grading-skill` and `motion-graphics-skill`)
exposes every one of its capabilities through one shared, generic tool id
(`audio-production/run`); tool-id-level evidence alone cannot distinguish which of the
capabilities sharing that id are individually requested, only that the shared endpoint as
a whole is. The diagnostic therefore correctly reports all of them as `PROVIDES_VALID`,
each annotated with its full sibling list (`evidence["shared_tool_id_capabilities"]`)
rather than silently claiming a confidence the tool-id join cannot support — the more
specific "5 unused" claim stands only as this item's own earlier manual reading, not as
something the shipped diagnostic asserts or can verify generically.

---

*Original scoping (2026-09-05/06), preserved for the reasoning it still applies:*
Per item 1's own Boundary, still binding: a new, additive, read-only report only, living
inside `video-production-agent` itself (the only place that already has
`default_registry()` and real adapter connections), not in this repository — this
project's own role is limited to having produced the `provides` data and the
Capability-id join methodology the diagnostic depends on, exactly as `docs/ROADMAP.md`
Phase 1's registry library was scoped to be consumed by, not built into, another
repository's tooling. **Never** changes `SkillRegistry.select_tool()`'s actual selection
behavior — diagnostic output only.

## 9. `video-production-agent`: a no-preset delivery ("deliver as-is") produces no Artifact and skips QC — RESOLVED 2026-09-06 (`ffmpeg-skill` PR #27 + `video-production-agent` PR #36)

**Update 2026-09-06 (`ffmpeg-skill` PR #27 + `video-production-agent` PR #36, both merged) — fully resolved**:
closes the last remaining gap from the PR #34 update below: Case B's Artifact registration
(a genuinely untouched, no-preset deliverable). `ffmpeg-skill` gained a real stream-copy
preset (`export.py --preset copy`: `-c:v copy -c:a copy`, no re-encode, keeps the source's own
extension and colour tags, skips the CFR-conforming/BT.709-retagging steps and the HDR
warning every re-encoding preset applies since neither is meaningful without decoding the
picture) — this is the cross-repo work the PR #32 update below said didn't exist yet.
`video-production-agent` then routes exactly the previously-unregistrable case through it:
`execution/compiler.py`'s `delivery()` now materializes a genuinely untouched subject (still
its own raw source asset, with a video stream) into the job's `artifacts/` directory via a
real `delivery_export` op instead of doing nothing, and `agent/planner.py`'s
`delivery_steps()` plans the matching step so the compiler has a tool selection to compile
against (ADR-021 — same shape as the PR #34 fix needed for the QC gate). The processed
no-preset case (PR #32/#33/#35's alias fix) is unchanged. A genuinely untouched *pure-audio*
subject on the audio-production path is deliberately excluded (`export.py --preset copy`
requires a video stream) — that narrower edge case still falls through to the pre-existing
(unregistered) behavior rather than crashing, and is not otherwise known to be reachable
today; a future item if it turns out to be. Verified for real: `IntegratedPipelineRealTests`
Scenario 11 now runs against real ffmpeg-skill, motion-graphics-skill and qc-skill and
asserts a genuinely untouched no-preset request gets one real stream-copy export, a real
registered Artifact (`MASTER`/`source`/`PASS`, credited to `ffmpeg-skill/export`), and a real
QC gate against the delivered (copied) bytes. New fake-adapter unit test added for fast
regression coverage. `tests/test_unit.py`: 188 passed (the by-now-familiar 2-4 environmental
failures depending on cwd, unrelated — see the running log below); `tests/test_integration.py`:
**45 passed, 0 skipped**, every real-Skill class, 0 regressions. This item is now fully closed
on both halves of its own title.

**Update 2026-09-06 (PR #34, merged)**: the QC half of the finding below is now fully
fixed, for both cases A and B — this reverses the "left `qc_gate()` untouched" call made in
the PR #32 update just below, and closes the "no-preset delivery skips QC" half of this
item's own title. Root cause was one layer deeper than the PR #32 investigation reached:
`agent/planner.py`'s `qc_steps()` only ever plans a qc `ProductionStep` (and its tool
selection) alongside a `delivery_export` step, which only exists for a preset target — so
there was never a tool for the compiler to find for a no-preset target, whether or not the
subject was processed. Fixed by having `qc_steps()` also plan a qc step for a no-preset
target (gating the subject's own current media directly — no re-encode, same real bytes as
the deliverable), `compiler.py`'s `qc_gate()` compiling that op instead of skipping the
target, and `qa/checks.py`'s `run_qa()` looking up the subject's own media too (only when
`qc=true`, so every other no-preset render's QA scope and cost is unchanged) so a genuinely
admitted qc report reaches the agent's own QA summary. Verified for real with qc-skill and
motion-graphics-skill: an untouched no-preset request now runs a real `qc/check` against the
real source (admitted, verdict PASS, surfaced as 6 real QA checks instead of 0); a processed
no-preset request now gets the same real gate against the real processed file, correctly
promoting the artifact to `approved` instead of the false `FAIL`/`NOT_READY` PR #32 left
behind (the check now actually runs instead of the ADR-032 fail-closed path reporting "no
report"). New real-Skill regression test added (`test_s11_qc_gate_without_a_delivery_preset`).
While validating this by running the suite from inside the checkout (needed for the
real-Skill classes' own sibling-discovery to work; a `/tmp` run skips them entirely), also
found and fixed an unrelated, second pre-existing gap this exposed:
`AudioProductionRealTests::test_two_inputs_concat_mono_normalize_end_to_end` still asserted
the *old*, buggy "generic profile registers no preset artifact" behavior as correct — a
stale assertion from before PR #32, never caught because it requires a real
`audio-production-skill` checkout. Updated it to assert the artifact is registered, matching
PR #32/#33's actual intended behavior. Full suite 308 passed (from `/tmp`); the two
real-Skill classes this touches, run from inside the checkout: `AudioProductionRealTests`
5/5, `IntegratedPipelineRealTests` 11/11, 0 regressions. **What's left**: Case B's Artifact
registration itself (an untouched deliverable is now correctly QC'd, but still has no
registered Artifact) — that part is unchanged and still needs the real stream-copy/remux
operation described below.

**Update 2026-09-06 (PR #32, merged)**: the finding below turned out to be two cases, not
one, and only one of them needed the cross-repo work described. **Case A — something real
was processed** (a motion-graphics element, or the always-on technical silence trim), just
with no delivery preset: `compiler.py`'s `delivery()` already resolves a real, in-workspace
path for it (verified for real with a motion-graphics text overlay); only
`service.py`'s `_register_artifacts()`'s `not t.get("preset")` guard was dropping it. **Fixed**
by removing that guard — `logical not in paths` alone already correctly leaves Case B (below)
unregistered, so nothing needed to change in `compiler.py`'s `delivery()` itself. Tried
dropping the identical guard in `compiler.py`'s `qc_gate()` too; reverted after it exposed a
real crash (`agent/planner.py`'s `qc_steps()` never plans a qc step for a no-preset target,
so `_step_tools()` has no tool selection for the compiler to find, and compiling one anyway
raises `CompileError`). Left `qc_gate()` untouched — `run_qa`'s existing ADR-032 fail-closed
check already covers a requested-but-unrun QC gate correctly and safely on its own (verified
for real: `--set qc=true` on Case A now registers the artifact but correctly comes back QA
`FAIL`/stage `NOT_READY` with `fix_hint: "the QC gate was planned but no report exists for
this artifact"` — honest, not a crash, not a false pass). New regression test added; full
suite 308 passed, 0 new regressions. **Case B — genuinely nothing was processed** (the plain
"nothing to do" request) is untouched by PR #32 and is exactly the remaining gap the rest of
this item describes below: it still needs the real stream-copy/remux operation.

**Found 2026-09-06** while verifying `video-production-agent` PR #31 (the zero-step
render-crash fix) end to end. A generic-profile plan with no delivery preset — "deliver
'main' as processed (no platform preset)", the single most common real request this
session's testing kept landing on — completes (`status: COMPLETED`) with `"artifacts": []`
in its own `report.json`. Nothing is actually delivered to the user; the source file just
sits wherever it originally was, unregistered, unhashed-as-delivered, un-QC'd.

**Root cause, confirmed by reading (not guessing)**: `execution/compiler.py`'s
`delivery()` only records a path for the deliverable when a preset re-encode ran or an
earlier operation already changed the subject's current media; with neither, no path is
ever set for it. The same `not t.get("preset")` condition is repeated independently in
`qc_gate()` (so `--set qc=true` never compiles a QC op for this case, silently) and in
`service.py`'s `_register_artifacts()` (so even a path that did exist would still never
become a registered Artifact).

**Tried the direct fix and it made things worse, on purpose reverted**: pointing the
no-preset deliverable at the subject's current media and dropping the three guards is a
one-line-per-site change, but a real render of the plain "nothing to change" plan then
failed with `ARTIFACT_OUTSIDE_WORKSPACE` — `artifacts/store.py`'s `check_path()` (ADR-022)
correctly refuses to register a path outside `<workspace>`, and an untouched source asset
lives at its own original path, never inside the job's workspace. That's a real security
boundary, not a bug to route around. Confirmed the revert left `git diff origin/main`
empty before moving on — nothing shipped from this attempt.

**What an actual fix needs**: a real stream-copy/remux operation (`ffmpeg -c copy`, no
re-encode, same bytes semantically) that writes the passthrough deliverable into the job's
own `artifacts/` directory, so it satisfies the workspace boundary like every other
delivered artifact. This does not exist today — `ffmpeg-skill`'s `scripts/export.py`
`PRESETS` dict has only `youtube` / `youtube4k` / `reels` / `x` / `prores` / `h265` / `gif`,
no copy/passthrough entry. So this is real, cross-repo work: `ffmpeg-skill` needs the new
preset (or `video-production-agent` needs its own local materialize-into-workspace
operation, if avoiding the extra Skill round-trip for a byte-identical copy is preferred),
plus `video-production-agent`'s compiler/registry/executor wiring to route to it. Not
attempted without that decision — see `OS_USABILITY_FLOW.md`'s P1 section for the same
writeup in the usability-flow document.

**Boundary**: this is a real product gap (the OS's own "return the result to the user"
step silently does nothing for the most common request), not a nice-to-have. Priority
should follow Mission > User value ordering accordingly once someone picks up the actual
implementation — this item exists so the next session doesn't have to re-derive the
`ARTIFACT_OUTSIDE_WORKSPACE` dead end from scratch.

## 10. `video-production-agent`: spurious "exceeds asset duration" on real, untrimmed footage — RESOLVED 2026-09-06 (PR #37)

**Found and fixed 2026-09-06** while searching for the next real gap after closing item 9.
A generic-profile plan against a real, untrimmed clip (no leading/trailing silence for the
profile to trim away — a screen recording, B-roll, anything that starts/ends mid-sound)
failed outright on both `plan` (validates immediately, exit 2) and `render` (job `FAILED`):
`temporal scope {'start': 0.0, 'end': 8.486} exceeds asset duration 8.485986`.

**Root cause, confirmed by reading**: a step/event/context scope meant to cover an asset's
*entire* duration is built via `round(dur, 3)` in several places (`agent/planner.py`'s
loudness/delivery/audio-cut scopes). `round(x, 3)` can round *up* by as much as `5e-4`
seconds versus the raw, unrounded probe duration. That rounded value is then checked by
`TimeRange.within()` (`models/__init__.py`), which used `TIME_EPS` (`1e-6`) as its
tolerance — 500× tighter than the rounding error that produced the value being checked in
the first place. Not a synthetic-media artifact: an exact multiple of 0.001s is essentially
never the true length of a real recording, so any asset whose duration's 4th decimal digit
is `>= 5` hits this — roughly half of all real, untrimmed footage. Every asset tested
earlier this session happened to either have an exactly round `lavfi`-generated duration, or
leading/trailing silence whose trim shifted the scope below the raw duration, incidentally
masking the bug both times.

**Fixed** (`video-production-agent` PR #37, merged): `TimeRange.within()` now uses a
dedicated `DURATION_EPS = 0.01` instead of `TIME_EPS` — matching `project/validator.py`'s
own, independently-chosen `0.01`s tolerance already used for the same class of check
(`video.trim`, `audio.cut`, `video.concat` range validation). `within()`'s only callers (5
call sites, confirmed via `grep`) are exactly this "does this range exceed the source
duration" check — no overlap/adjacency/precedes logic uses it, so `TIME_EPS` itself is
untouched everywhere else. Verified by reproducing the exact failure directly
(`TimeRange(0, round(8.485986, 3)).within(8.485986)`: `False` before, `True` after) and via
a full plan+validate+render regression with `FakeAdapter(duration=20.485986)` (confirmed
failing before the fix by stashing it and re-running, passing after). New regression tests
added. `tests/test_unit.py`: 187 passed (4 known environmental failures, unrelated);
`tests/test_integration.py`: **45 passed, 0 skipped**, every real-Skill class, 0
regressions.

## 11. `video-production-agent`: an explicit loudness-normalization request on audio-less input silently disappears — RESOLVED 2026-09-06 (PR #38)

**Found and fixed 2026-09-06** while searching for the next real gap after item 10.
`video-agent plan noaudio.mp4 --profile generic --set audio.normalize=true --set
audio.loudness.target_lufs=-16` on a real, audio-less clip (muted b-roll, a screen recording
without a mic) planned and rendered cleanly to `COMPLETED`/QA PASS, but the printed
"Decisions:" list, `explain --decision audio.loudness` ("no such decision"), and the final
`report.md` all showed **zero** mention of loudness or audio anywhere — the user's explicit
request simply vanished with no explanation anywhere a normal workflow would look.

**Root cause, confirmed by reading**: `agent/decision.py`'s entire `audio.loudness` decision
block was gated on `asset.technical.get("audio")` — when false, the whole `if` was skipped
and no `Decision` object was ever created at all. Inconsistent with `audio.production`'s
analogous case a few lines above, which explicitly emits `BLOCK: {asset} has no audio
stream` when audio production is requested on a video-only input. Same class of "user
request silently no-ops" bug as item 9, but for loudness normalization on any real-world
audio-less clip.

**Fixed** (`video-production-agent` PR #38, merged): split the gating condition so a
loudness request on an audio-less asset now emits an explicit `SKIP` decision explaining why
(`"{asset} has no audio stream; loudness normalization needs one (unsupported input, not
guessed)"`), matching `audio.production`'s existing pattern; the rest of the decision logic
(silent/ambient/off-target/keep cases) is untouched. Verified for real: reproduced the exact
silent disappearance on a generated audio-less clip before the fix (confirmed empty in
`plan`, `explain`, and `report.md`), confirmed all three now show the `skip` decision and
reason after the fix. New regression test using `FakeAdapter(audio=False)`.
`tests/test_unit.py`: 188 passed (4 known environmental failures, unrelated);
`tests/test_integration.py`: **45 passed, 0 skipped**, every real-Skill class, 0
regressions.

**Also investigated and ruled out this session**: a caption-burn-in "oversized text on
portrait/reels video" hypothesis. Initial visual inspection of a burned-in caption on a
1080x1920 clip looked dramatically oversized compared to landscape, and an initial fix
(`ffmpeg-skill caption.py`'s `subtitles=` filter given an explicit `original_size` reference)
was drafted and even seemed to visually resolve it. Rigorous per-line pixel measurement
(isolating individual wrapped lines, then re-testing with single-word, unwrappable cue text
across a dozen resolutions and aspect ratios from 200x1920 to 1920x200) proved the
"oversized" appearance was **entirely explained by ordinary text wrapping**: the caption text
used in testing didn't fit the narrower portrait frame's width at the same font size, so it
correctly wrapped to two lines — which, measured as one combined block, looked ~2-3x taller
than a single line, but each individual line's height was proportionally identical to the
landscape case (within ~2% across every resolution tested). There is no font-scaling defect;
the draft fix (which would have changed default caption sizing/wrapping behavior for every
existing caller, on a false premise) was reverted before commit. Recorded here so a future
session doesn't have to re-investigate the same false lead.

## 12. `video-production-agent`: the `delivery.platform` free-text keyword is dead code — RESOLVED 2026-09-06 (PR #39)

**Found and fixed 2026-09-06** while searching for the next real gap after item 11.
`agent/requirements.py`'s `KEYWORDS` pass has captured a named platform from free text since
it was written (`r"\byoutube\b"` → `delivery.platform="youtube"`), and the capture genuinely
works: `video-agent plan <video> --profile generic --request "please upload this to
youtube"` really does add a `delivery.platform="youtube"` requirement to `project.json`. But
nothing ever read it back — confirmed by exhaustive `grep -rn '"delivery.platform"' src/`:
only its own definition, no consumer anywhere in `decision.py`, the planner, or the compiler.
`delivery.targets` is sourced only from the profile's own fixed JSON. So the request was
captured, then silently discarded — the plan, decisions, and delivered file were identical to
never having mentioned a platform. Same class of "silent request disappearance" as items 9
and 11, but at the natural-language layer, and this one never worked even partially (unlike
the already-known "small hand-written phrase list" scope limitation, where the gap is missing
*coverage*, not a phrase that matches and then does nothing).

**Fixed** (`video-production-agent` PR #39, merged): the delivery decision loop now applies a
named platform to the profile's own preset-less targets — the platform name is the preset
name for the one platform this keyword pass currently recognizes (`youtube`), the same
outcome `--profile youtube` would produce. A target that already carries an explicit preset
(`conference`, or `--profile youtube` itself) is left untouched — this only fills a gap, it
never overrides an explicit choice. Verified for real: `--request "please upload this to
youtube"` on the generic profile now shows the youtube preset in `plan`, cites the
requirement in `explain`, and a full `render` genuinely runs the youtube export + platform
check (QA correctly caught the un-normalized test tone's loudness, proving the real pipeline
ran, not a no-op). Confirmed no interference with profiles that already choose a preset. New
regression test.

The same PR also fixed a second, small, independently-found bug from the same investigation:
`video-agent explain --decision/--step/--context/--observation/--pipeline` crashed with a raw
`NoneType` Python error instead of a clear message when the optional `PROJECT` argument was
omitted (`cli.py`'s `cmd_explain` called `load_ir(args.project)` unconditionally except in
`--artifact` mode). Fixed with an explicit upfront check. `tests/test_unit.py` +
`tests/test_requirements.py`: 196 passed (4 known environmental failures, unrelated);
`tests/test_integration.py`: **45 passed, 0 skipped**, every real-Skill class, 0 regressions.
