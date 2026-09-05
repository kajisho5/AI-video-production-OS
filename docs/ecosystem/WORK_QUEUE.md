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

## 2. Land the remaining `provides` rollout PRs

Six PRs still open as of the last check (`subtitle-skill#2`, `thumbnail-skill#2`,
`color-grading-skill#4`, `motion-graphics-skill#2`, `qc-skill#5`, `ffmpeg-skill#24`) — all
CI-green, driven per the standing PR-maintenance rules. Mostly reactive (respond to CI/
review events as they arrive) rather than work to actively schedule.

## 3. `registry/` conformance harness: real per-Skill wiring for the 5 stubbed checks

`registry/conformance.py` has 3 of 8 `SKILL_SPEC.md` §8 checks implemented for real; the
other 5 (forbidden-keys rejection, no-unsafe-shell-out, workspace confinement, no-clobber-
input, doctor status) need a live Skill process to run against. Real value: this is the
mechanism `PLUGIN_MODEL.md` names for rejecting an unsafe third-party Skill without human
judgment — currently only a promise, not a working gate. Scope: wire it against 1-2 real
Skills first (e.g. `qc-skill`, `thumbnail-skill`, both already locally cloned this
session) to prove the pattern before generalizing.

## 4. A standalone JSON Schema file for the CapabilityContract's `provides` shape

`registry/` validates `provides` entries in Python; `docs/ROADMAP.md` Phase 1 item 1 also
asked for a standalone `.schema.json`. Low effort, real value for any non-Python consumer
(a third-party Skill author who wants to validate their own `provides` output without
importing this project's Python code).

## 5. Confirm or refute the qc-skill/media-analysis-skill "collision avoidance by role separation" hypothesis

`CROSS_REPO_STATUS.md` flags that `video-production-agent`'s registry may not actually
expose the `measure.audio.loudness` collision as a live choice (qc-skill appears to be used
only as a final gate, not a competing per-measurement Provider). Read the Agent's ADRs
(and, if needed, ask a scoped question) to confirm whether this is deliberate design or an
accident, and update `CURRENT_STATE.md`'s "UNKNOWN" section with the answer either way.

## 6. VISION-tier, not yet actionable: AI Provider connection

The single biggest gap between "what this ecosystem can do" and "what the Mission
describes" (natural-language intent → plan) is that no real LLM reasoning is wired into
`video-production-agent` — only `NullProvider`. This is real, important, and explicitly
out of scope for immediate action: it is `video-production-agent`'s own architecture to
extend (its `AI Provider contract`, ADR-018, already defines the boundary — "AI proposes,
never executes"), not something this project should implement unilaterally inside another
repository. Track it here as the thing to watch for, not a task to start.
