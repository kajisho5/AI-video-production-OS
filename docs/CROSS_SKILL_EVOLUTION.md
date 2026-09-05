# Cross-Skill Evolution

Status tags used throughout, matching every other document in this project: **CURRENT**
(verified in the audited repos today), **FUTURE** (proposed, not implemented anywhere
yet), **EXPERIMENTAL** (exists but unstable/stubbed/provisional), **UNKNOWN** (could not
be determined from available evidence), **PROPOSED** (a specific new addition to an
existing ground-truth document, named as such rather than silently assumed adopted).

This document covers concerns that span multiple Skills rather than belonging to any one
repo's row in `SKILL_EVOLUTION.md`. It does not repeat that document's per-repo detail,
and it does not repeat `CAPABILITY_MATRIX.md`'s capability-to-provider table — it cites
specific capability ids from both only where a cross-cutting argument needs them. Nothing
below invents a capability, gap, or migration mechanic beyond what
`REPOSITORY_MAP.md`, `CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`, `ARCHITECTURE.md`,
`ROADMAP.md`, `CAPABILITY_MATRIX.md`, `DEPENDENCY_GRAPH.md`, `SPEC.md`, `SKILL_SPEC.md`,
`VERSIONING.md`, `PROVENANCE.md`, or `SECURITY_MODEL.md` already evidence.

---

## 1. Capability negotiation: choosing among multiple AVAILABLE Providers

**FUTURE — this entire section describes a concern that does not exist as implemented
infrastructure anywhere in the ecosystem today.** No repo, including
`video-production-agent`, has cost, latency, or hardware-aware Provider scoring; the
closest thing that exists is `SkillRegistry.select_tool()`'s hardcoded ordered
candidate list, which `CAPABILITY_MODEL.md` names explicitly as the silent default this
OS replaces (`CAPABILITY_MODEL.md` §"Capability collision policy").

Once a Plan (or an Agent building one) requests a Capability id and the registry reports
more than one `AVAILABLE` Provider, the question this section answers is: on what basis
should the Agent/OS choose? Per `CAPABILITY_MODEL.md`'s three-tier collision policy, an
explicit choice always wins first (Plan-time `provider_id`), and a default-provider
policy file wins second — negotiation only matters for the third tier, where the
Capability Contract itself must supply the criteria a human-authored default-provider
policy, or an Agent making a first-time selection, would reasonably use. Grounded in what
Capability Contracts already declare or are proposed to declare (`SPEC.md` §1,
`CAPABILITY_MODEL.md` §Capability lifecycle):

- **`contract_version` compatibility** — CURRENT-shaped: a Provider whose declared
  `contract_version` falls outside a step's/Skill's declared `version_range`
  (`VERSIONING.md` §2) is not eligible at all; this is filtering, not scoring, and is the
  one criterion this ecosystem already has real mechanics for (the
  `SUPPORTED_MIN`/`SUPPORTED_MAX` pattern in `video-editing-skill`,
  `audio-production-skill`, `color-grading-skill`'s ffmpeg-skill adapters).
- **Lifecycle state** — a Provider whose Capability registration is `STABLE` is a more
  conservative default choice than one still `EXPERIMENTAL`, per `CAPABILITY_MODEL.md`'s
  5-state model. Today every single registered capability in `CAPABILITY_MATRIX.md` is
  `EXPERIMENTAL` (zero `STABLE` entries exist anywhere in the ecosystem), so this
  criterion currently cannot discriminate between qc-skill and media-analysis-skill's
  loudness measurement — both are equally `EXPERIMENTAL` — but the criterion itself is
  real and becomes load-bearing the moment any Provider is promoted.
- **Declared determinism** — `deterministic_inputs` is an existing `ffmpeg-skill`
  `ToolSpec` field (`SPEC.md` §1; `ARCHITECTURE.md` §9, red-team lens 4) and is the one
  criterion `ARCHITECTURE.md` explicitly worries about: negotiation must not let an Agent
  quietly swap in a nondeterministic Provider where a deterministic one was expected. A
  negotiation policy should treat `deterministic_inputs: true` as a hard filter for any
  step whose caching/reproducibility guarantee depends on it (`PROVENANCE.md` §5's
  "deterministic reproducibility" claim), not merely a soft preference.
- **Resource hints** — `ARCHITECTURE.md` §10 names the only Resource-shaped facts this
  ecosystem actually has today: coarse hints already implicit in `ffmpeg-skill`'s
  `ToolSpec` (`requires_visual_verification`, `audio_only`, `video_required`). These let
  an Agent make a cheap local-vs-not-applicable eligibility check, not a scored ranking.

**Explicitly NOT a criterion, because no repo has any of this infrastructure today:**
cost, latency, or hardware-aware scoring (GPU availability, encode speed, per-call
pricing). `ARCHITECTURE.md` §10 and §9 (red-team lens 5) are explicit that this class of
concern is Roadmap Phase 8, deliberately deprioritized because "no evidence of scale or
resource-scheduling need anywhere in the audited ecosystem today" — inventing scoring
criteria here would be exactly the architecture-astronautics failure mode
`ARCHITECTURE.md` repeatedly rules out. **This whole negotiation mechanism is FUTURE
work; nothing today implements Provider negotiation beyond first-match-wins.**

---

## 2. Provider fallback

**CURRENT policy (cited, not modified):** `CAPABILITY_MODEL.md`'s three-tier collision
policy — (1) Plan-time explicit `provider_id`, always wins if present; (2) a
Workspace/OS-level default-provider policy file; (3) registry refusal, loud, if neither
exists and more than one Provider is `AVAILABLE`. This is already the ecosystem's answer
to "what happens when a Capability has more than one Provider," and this document does
not change it.

### PROPOSED addendum: fallback must be constrained by Intent-level Hard Constraints and Permissions

**PROPOSED — not implemented anywhere, and not yet stated in `CAPABILITY_MODEL.md`
itself.** The three-tier policy as written answers "which Provider gets picked when more
than one is available." It does not yet answer a related but distinct question: **when a
chosen or default Provider becomes unavailable mid-Plan (or was never available), under
what conditions may the system fall back to a different Provider of the same
Capability, versus fail outright?**

The refinement this document proposes: **fallback selection must never silently violate
a Hard Constraint or Permission declared at the Intent/Plan level.** Two concrete,
evidence-grounded examples:

- A hypothetical `execution.local_only` permission (directly analogous to
  `video-production-agent`'s existing `SYSTEM_CONSTRAINTS.execution.no_raw_shell`
  pattern, `REPOSITORY_MAP.md`) must block falling back to any hypothetical future
  cloud-hosted Provider of a Capability, even if that cloud Provider is `AVAILABLE` and
  would otherwise be the next candidate in a default-provider policy's ordering. Today
  this scenario is entirely hypothetical — `ARCHITECTURE.md` §4 confirms no repo in the
  ecosystem has a network-based Provider of anything — but the constraint mechanism this
  addendum proposes is not: it is the same shape as the `no_raw_shell` system constraint
  that already exists and is already enforced unconditionally.
- A Hard Constraint such as "high-quality ASR required" attached to a Plan step
  requesting `transcribe.audio` must block silent fallback to a lower-quality Provider
  (e.g., a hypothetical smaller/faster `faster-whisper` model tier, or a future
  alternative ASR engine) if that fallback would violate the declared constraint. This is
  a direct generalization of `CAPABILITY_MODEL.md`'s own three-tier policy's Rule
  1 — a Plan-time explicit choice already always wins — extended to say that an *implicit*
  fallback, when tier 1 or 2 doesn't specify a Provider by name but does specify a
  quality/capability floor, must respect that floor rather than defaulting past it.

**Why this is PROPOSED, not adopted:** `CAPABILITY_MODEL.md`'s collision policy as
written is silent on this specific interaction — it defines how a Provider is *chosen*
among currently-`AVAILABLE` candidates, not how a *previously-selected* Provider going
unavailable mid-execution should be handled relative to Hard Constraints declared
upstream in an Intent. No repo's evidence shows this interaction has ever been designed,
tested, or even encountered (no repo has more than one real Provider option for anything
today outside the qc-skill/media-analysis-skill collision, and neither of those differs
in a way a "high-quality" or "local-only" constraint would discriminate between). This
document names the gap and proposes the rule as an addendum to `CAPABILITY_MODEL.md`'s
existing policy; it is not itself an amendment to that document, and should be reconciled
there before Phase 3 implementation, per `ROADMAP.md` Phase 0's own instruction that
Phase 1 "should not start schema work that contradicts" documents still being closed
out.

**What this requires, concretely, once adopted (FUTURE):** a Plan's `constraints` field
(`SPEC.md` §3, already an existing field on `ProductionPlan`) needs to be resolvable
against a Capability's declared attributes (quality tier, `deterministic_inputs`,
locality — none of which exist as declared fields on any Capability today beyond
`deterministic_inputs`) at fallback-decision time, not only at initial Plan validation
time. This is new schema surface, not new infrastructure — the same `constraints` object
`SPEC.md` §3 already defines, read at a second point in the Operation lifecycle
(fallback) as well as the first (initial structural validation).

---

## 3. Provider discovery

**CURRENT, per-Skill:** every Skill's `doctor` command (`SKILL_SPEC.md` §1, §3) reports,
per capability the Skill declares, whether it is `AVAILABLE` or `MISSING` and why —
missing binary, missing optional dependency, unmet OS requirement. This is the mechanism
`SkillRegistry.select_tool()` already depends on to determine which candidates are even
eligible to be chosen from (`SKILL_SPEC.md` §1). `ffmpeg-skill`'s own `doctor`
capability-detection report is the pattern name `CORE_PRIMITIVES.md` §3 and
`CAPABILITY_MODEL.md` §Provider both cite by name as the existing discovery mechanism.
Discovery today is therefore **per-Skill and pull-based**: an Agent (or a human) invokes
each Skill's own `contract`/`doctor` commands individually and assembles the picture
itself — there is no single place to ask "what can this system do right now" across all
11 repos at once. `video-production-agent`'s own `capabilities/resolver.py` does exactly
this assembly today, but only for its own hand-registered adapter set
(`Service.adapter()`), which is itself a manually-maintained list, not a discovered one
(`REPOSITORY_MAP.md`).

**FUTURE, proposed consolidation:** a single OS-level registry query — "who provides
Capability X, and which of them report `AVAILABLE` right now" — that internally still
calls each Skill's own `contract`/`doctor` commands (no new discovery mechanism is
invented; this is the Phase 1 registry library from `ROADMAP.md` querying the same
per-Skill entrypoints that already exist) but exposes one answer instead of requiring an
Agent to enumerate and query every Skill by name itself. This directly closes the gap
`ARCHITECTURE.md` §11's final test names: "New, unimagined Skill tomorrow, no OS core
changes?" — answerable "yes" only once discovery is registry-driven rather than requiring
`video-production-agent`'s `Service.adapter()` table to be hand-edited for every new
Skill (`ARCHITECTURE.md` §9, red-team lens 2, explicitly named as Roadmap work, not
already solved).

**Sequencing, per `ROADMAP.md`:** Phase 1 builds the registry library capable of
answering "who provides Capability X" from a set of already-published
`CapabilityContract` documents; Phase 2 gets every Skill actually publishing one; Phase 4
is what replaces `video-production-agent`'s `Service.adapter()` manual wiring with
queries against that registry instead of a hand-maintained table. Nothing before Phase 4
changes how discovery actually happens inside `video-production-agent` — Phase 1-3 build
the registry and its collision policy without yet routing real executions through it
(`ROADMAP.md`, "What changes about `video-production-agent`, and what does not").

---

## 4. Worked example: the qc-skill/media-analysis-skill collision, step by step

This is the ecosystem's **one confirmed, already-occurred Capability collision**
(`REPOSITORY_MAP.md` finding 2; `CAPABILITY_MATRIX.md` §8a), and it is the canonical
example this whole document's negotiation/fallback/discovery sections exist to make
concrete. Walking through it with the actual capability ids:

**Step 1 — the collision as it exists today (CURRENT, fact).** Three capability ids are
each independently implemented twice, with no shared library and no registry to notice
the duplication:

| Capability id | qc-skill implementation | media-analysis-skill implementation |
|---|---|---|
| `measure.audio.loudness` | `measurements/audio.py`, `ebur128` (LUFS/LRA/true-peak) | `analyzers/loudness.py`, also `ebur128`, independently parsed |
| `measure.audio.silence` | `silencedetect`-based check | `silence` analyzer |
| `measure.audio.integrity` | decode-integrity check + `_decode_errors.py` | `integrity`: full decode via `-f null`, decode-error/frame-count/timestamp checks |

`CAPABILITY_MATRIX.md` §8a's important asymmetry: qc-skill's own docs explicitly
reference and position against media-analysis-skill; media-analysis-skill's docs and code
contain **zero** references to qc-skill, despite acknowledging overlap with ffmpeg-skill
by name. This is not a strict superset/subset relationship either — qc-skill additionally
does black/freeze-frame detection (`measure.video.freeze`, `measure.video.black_frame`)
that media-analysis-skill does not implement at all, and media-analysis-skill does
scene-detection (`measure.video.scene_detection`) and A-V-sync timing
(`measure.video.timing`) that qc-skill does not implement at all
(`CAPABILITY_MATRIX.md` §8b/§8c).

**Step 2 — why this happened (CURRENT, diagnosis).** No Capability id existed for either
Skill to register against (`DEPENDENCY_GRAPH.md` §4.1: "today, `qc-skill` and
`media-analysis-skill` cannot express 'I am an alternate Provider of the same thing as X'
at all, because there is no Capability id for either of them to register against"). The
`Skill` word itself was overloaded for both "a package" and "an internal capability name"
(`CORE_PRIMITIVES.md` §2's `SkillPackage`/`SkillSpec` naming collision), which is exactly
the ambiguity that let two independently-correct implementations coexist without either
author's tooling ever being able to notice the overlap as overlap rather than divergent
design.

**Step 3 — what changes under this OS's model (FUTURE, per `CAPABILITY_MODEL.md` and
`ROADMAP.md` Phase 3).** Both Skills additively publish a `CapabilityContract`
(Phase 2) that registers each as a **Provider** of the same Capability id — for example,
`qc-skill` registers `{capability_id: "measure.audio.loudness", provider_id:
"qc-skill"}` and `media-analysis-skill` registers `{capability_id:
"measure.audio.loudness", provider_id: "media-analysis-skill"}`. **Neither implementation
moves.** No code is relocated from one repo to the other, no repo is deprecated in favor
of the other — this is the explicit call `CAPABILITY_MODEL.md` makes and this document
restates plainly: *both register as Providers of the same Capability id.* The registry
now has a fact it can act on (two Providers of `measure.audio.loudness`) where today it
has silent duplication instead.

**Step 4 — resolution when a Plan requests `measure.audio.loudness` (FUTURE, Phase 3
mechanics).** Applying `CAPABILITY_MODEL.md`'s three-tier policy concretely to this
exact Capability:
1. If the Plan step names a `provider_id` explicitly (`"qc-skill"` or
   `"media-analysis-skill"`), that Provider runs. This is recorded in provenance
   (`PROVENANCE.md` §2: "Capability id + Provider id... two Providers of
   `measure.audio.loudness` are not interchangeable for reproducibility purposes even
   though they answer the same Capability").
2. If no explicit choice exists, a Workspace/OS-level default-provider policy file (not
   yet built anywhere — `ARCHITECTURE.md` §12 names this as an open question carried into
   `ROADMAP.md`, still unresolved whether it lives in a Workspace config or the OS
   registry itself) supplies a default.
3. If neither exists, Plan validation **fails loudly** — "Ambiguous Provider for
   `measure.audio.loudness`: 2 AVAILABLE (`qc-skill`, `media-analysis-skill`); specify
   `provider_id` or configure a default-provider policy" — rather than
   `SkillRegistry.select_tool()`'s current behavior of silently picking the first
   candidate in a hardcoded ordered list.

**Step 5 — what this does not change.** `qc-skill`'s ADR-001 boundary ("not an AI agent,
does not make production decisions") is untouched; media-analysis-skill's "no AI, purely
observational" scope is untouched. Neither Skill's own measurement logic, thresholds, or
output format change at all — this is a registry-and-resolution fix, not a
re-implementation (`ROADMAP.md` Phase 3: "converts silent duplication into a visible,
queryable registry fact, which is most of the value of this phase").

---

## 5. Migration bridges: an ffmpeg-skill `contract_version` breaking bump

Five Skills depend on `ffmpeg-skill`: `video-editing-skill`, `audio-production-skill`,
`color-grading-skill`, `motion-graphics-skill`, `thumbnail-skill` (partial, `extract_frame`
only) — plus `subtitle-skill` (partial, `render`/burn-in only), six in total per
`DEPENDENCY_GRAPH.md` §1.1, though the task's framing of "5 of them" tracks the five
**fully-delegating** Skills `DEPENDENCY_GRAPH.md` §2 discusses by name for the
version-pinning pattern. Walking through what happens if `ffmpeg-skill`'s
`contract_version` bumps in a breaking way, using `VERSIONING.md`'s two-axis model and
the `SUPPORTED_MIN`/`SUPPORTED_MAX` pattern already found in three of those adapters
(`video-editing-skill`, `audio-production-skill`, `color-grading-skill`,
`VERSIONING.md` §2):

**Step 1 — what "breaking" means here (CURRENT definition, PROPOSED as no repo has
observed one yet).** Per `VERSIONING.md` §3, a breaking change is one of: removing a
previously-published capability id, narrowing an `input_schema` (removing an accepted
parameter, tightening a range/type, making an optional parameter required), changing a
capability's `output_artifact_types` to something a dependent isn't handling, silently
changing a parameter's meaning without changing its name/type, or flipping
`mutates_input`/`deterministic_inputs` guarantees. `ffmpeg-skill`'s `contract_version`
has never moved from `"1.0"` across its whole `0.8.3`→`0.9.1` `skill.version` span
(`VERSIONING.md` §1) — this section is therefore describing mechanics that are
specified but not yet observed in practice anywhere in the ecosystem.

**Step 2 — the version bump itself.** `ffmpeg-skill` bumps `contract_version` from
`"1.0"` to, say, `"2.0"` (major, per `VERSIONING.md` §3's closing note that a
`contract_version` bump is informally treated as major/minor even though SemVer
specifically is not mandated). `skill.version` also advances (e.g. `0.9.1` → `1.0.0`),
but the two axes are independent — a dependent must react to the `contract_version`
change, not the `skill.version` change (`VERSIONING.md` §1).

**Step 3 — what each dependent's adapter does at startup, mechanically.** Each of the
delegating Skills' single designated adapter module (`ffmpeg_skill.py`/`adapter.py`,
`SKILL_SPEC.md` §5) locates its `ffmpeg-skill` checkout and checks the located
checkout's `contract_version` against its own hardcoded `SUPPORTED_MIN`/`SUPPORTED_MAX`
range — the exact mechanism already implemented in `video-editing-skill`'s,
`audio-production-skill`'s, and `color-grading-skill`'s adapters
(`REPOSITORY_MAP.md`, `VERSIONING.md` §2). If the new `contract_version` `"2.0"` falls
outside a dependent's declared range (e.g. its `SUPPORTED_MAX` is still `"<2.0"`), that
dependent **fails fast with a clear error at startup**, before ever attempting to invoke
the now-incompatible tool — this is the existing, working behavior, not new mechanics
this document invents.

**Step 4 — the dependent is not silently broken by a live call.** Because the check
happens at adapter startup/dependency-resolution time rather than being discovered
mid-call, a breaking `ffmpeg-skill` bump surfaces as an explicit, actionable
"unsupported dependency version" error rather than a malformed request reaching
`ffmpeg-skill` and failing unpredictably, or — worse — succeeding with silently different
semantics. This is `VERSIONING.md` §2's entire justification for pinning a range rather
than an exact version: the dependent can float across every `ffmpeg-skill` release whose
`contract_version` stays within its declared range, and fails loudly and immediately, not
subtly, the moment a release moves outside it.

**Step 5 — until each dependent's range is widened.** A dependent Skill remains
incompatible with `ffmpeg-skill` `contract_version` `"2.0"` and above until its own
maintainer reviews `VERSIONING.md` §3's breaking-change list against what actually
changed, updates the dependent's code to accommodate the new shape (e.g. handling a
narrowed `input_schema` or a changed `output_artifact_types`), and widens its
`SUPPORTED_MIN`/`SUPPORTED_MAX` range to include `"2.0"`. This is ordinary,
per-dependent migration work — no ecosystem-wide flag day is required, since each of the
five (six, counting `subtitle-skill`'s partial dependency) delegating Skills pins and
migrates independently, exactly as `ROADMAP.md` Phase 2's parallelizability argument
already establishes for contract retrofitting generally.

**Step 6 — the one real, present inconsistency this bridges into.**
`DEPENDENCY_GRAPH.md` §2 flags a genuine, already-existing risk relevant to this exact
scenario: the five delegating Skills' own CI pins `ffmpeg-skill` to a specific commit
(`2abd89c`) for testing, while `video-production-agent`'s integration CI clones **all**
sibling Skills (including `ffmpeg-skill`) at **default-branch HEAD**, not at pinned
commits. Concretely, if `ffmpeg-skill` merges a breaking `contract_version` bump to its
default branch, `video-production-agent`'s integration CI would immediately start
exercising the new, incompatible contract shape against every dependent's adapter — some
of which may not have updated their `SUPPORTED_MIN`/`SUPPORTED_MAX` range yet — while the
five delegating Skills' own CI, still pinned to the pre-bump commit, would show no
problem at all. `DEPENDENCY_GRAPH.md` §2 names this as a real versioning risk
`VERSIONING.md` should address (either by moving `video-production-agent`'s integration
CI to pinned-commit/pinned-tag checkouts matching the five-Skills pattern, or by
explicitly documenting HEAD-tracking as an intentional early-warning choice) — this
document does not resolve which is correct, since the audit found evidence of the
disagreement but no evidence of which behavior was intended.

**What does not change under this mechanism, per `DEPENDENCY_GRAPH.md` §4.3 and
`ARCHITECTURE.md` §9, red-team lens 9:** the single-designated-adapter-module pattern
itself, the `SUPPORTED_MIN`/`SUPPORTED_MAX` range-check mechanic, and the underlying
list-argv subprocess invocation are all already correct and are not redesigned by this
OS — the OS's contribution is generalizing this already-working, independently-arrived-at
pattern into an OS-wide rule (`VERSIONING.md` §1-2), not inventing new versioning
mechanics for the ffmpeg-skill dependency specifically.

---

## Summary

| Concern | Status | What exists today | What this document proposes |
|---|---|---|---|
| Capability negotiation | FUTURE | `SkillRegistry`'s hardcoded ordered list (first-match-wins) | Filter/preference criteria from contract, lifecycle, determinism, resource hints — no cost/latency/hardware scoring |
| Provider fallback | CURRENT policy + PROPOSED addendum | Three-tier collision policy (`CAPABILITY_MODEL.md`) | Constrain fallback by Intent-level Hard Constraints/Permissions — PROPOSED addition, not yet in `CAPABILITY_MODEL.md` |
| Provider discovery | CURRENT per-Skill, FUTURE consolidated | Per-Skill `doctor`/`contract` commands, queried individually | One OS-level registry query over the same per-Skill entrypoints |
| qc-skill/media-analysis-skill collision | CURRENT problem, FUTURE fix (Phase 3) | Silent duplication, one-directional awareness | Both register as Providers of the same Capability id; neither's code moves |
| ffmpeg-skill breaking bump | CURRENT mechanism, never yet exercised | `SUPPORTED_MIN`/`SUPPORTED_MAX` range checks in 3+ adapters | Same mechanism generalized OS-wide; named CI-pinning inconsistency left as an open `VERSIONING.md` question |
