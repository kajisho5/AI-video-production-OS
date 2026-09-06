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
- No live npm/PyPI version lookup yet (`MATURITY_MODEL.md` level 6 relies entirely on
  `capability-status.json`'s documented `distribution` field).
- No snapshot history/trend view (deliberately deferred, per `MATURITY_MODEL.md`'s own
  "deliberately not part of this model" section).
- `capability-status.json`'s documented (non-automatic) fields will drift from reality
  over time unless updated in the same commit as the prose docs they mirror — this is
  the accepted, explicit limitation ADR-011/MATURITY_MODEL.md already name, not a new
  finding, but worth remembering the next time `CROSS_REPO_STATUS.md` changes.

## 4. A standalone JSON Schema file for the CapabilityContract's `provides` shape

`registry/` validates `provides` entries in Python; `docs/ROADMAP.md` Phase 1 item 1 also
asked for a standalone `.schema.json`. Low effort, real value for any non-Python consumer
(a third-party Skill author who wants to validate their own `provides` output without
importing this project's Python code).

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
