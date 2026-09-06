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

## 7. Ecosystem Dashboard (`dashboard/`) — IMPLEMENTED 2026-09-05, one manual step remaining

Built per an explicit user request: a read-only, mobile-first, PWA-ready web dashboard
over the ecosystem's real GitHub state. See `dashboard/README.md` and
`docs/adr/ADR-011-ecosystem-dashboard.md` for the architecture, `docs/ecosystem/
MATURITY_MODEL.md` for the maturity ladder it renders. 50 tests, all passing, no network
access required by any of them.

**Remaining, human-only step**: enable GitHub Pages for this repository (Settings →
Pages → Source: "GitHub Actions") — outside this project's write access. Until that's
done, `.github/workflows/dashboard.yml` will build and test successfully but the deploy
step will fail. Not a code gap.

**Real gaps worth revisiting, in rough priority order**:
- The committed `dashboard/web/public/data/ecosystem-snapshot.json` was produced by
  running the real aggregator pipeline against real-as-of-2026-09-05 fixture facts (this
  development sandbox's own GitHub access is MCP-tool-only; raw `api.github.com` calls
  are blocked by its egress policy — see `dashboard/README.md`'s "Known gaps"). The
  workflow's first real scheduled/dispatched run will overwrite it with genuinely live
  data — worth confirming this actually happens once Pages is enabled, rather than
  assuming it silently.
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

## 8. A read-only `--check-provides` diagnostic for `video-production-agent`

Item 1's 2026-09-06 exhaustive investigation confirmed this is now concretely buildable
with real, useful day-one output: it would correctly surface `qc_check` and
`subtitle_generation`/`subtitle_burn_in`'s self-declared (contract-unconfirmed) tool ids as
informational, not errors (join on Capability id, never tool-id string — item 1's own
finding), and would report `video-editing-skill`'s unused `video.trim` and
`audio-production-skill`'s five unused capabilities (`audio.dynamics`, `audio.mix`,
`audio.noise_reduction`, `audio.silence_remove`, `audio.trim`) as "published, not yet
consumed by any `SkillSpec`" — real, actionable signal for future roadmap prioritization,
not noise.

**Scope, precisely** (per item 1's own Boundary, still binding here): a new, additive,
read-only report only — e.g. a script that fetches each installed Skill's real `contract
--json`, extracts `provides[]`, and cross-references it against `default_registry()`'s
`SkillSpec.tools` by Capability id (not tool-id string). It would live inside
`video-production-agent` itself (the only place that already has `default_registry()` and
real adapter connections), not in this repository — this project's own role is limited to
having produced the `provides` data and the Capability-id join methodology this diagnostic
would depend on, exactly as `docs/ROADMAP.md` Phase 1's registry library was scoped to be
consumed by, not built into, another repository's tooling. **Never** changes
`SkillRegistry.select_tool()`'s actual selection behavior — diagnostic output only.

**Depends on:** nothing further in this repository — item 1's investigation already
supplies the exact findings such a diagnostic should reproduce, usable as its own test
fixtures/expected-output once someone builds it (in `video-production-agent`, by whoever
owns that repository's roadmap).
